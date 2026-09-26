import { db } from "@/lib/db";
import { llmManager } from "@/lib/providers/llm/manager";
import type { ChatTurn } from "@/lib/providers/llm/types";
import { answerWithKnowledge } from "@/lib/rag/pipeline";
import { loadAgentMemory, remember } from "./memory";
import { executeTool, listAgentTools } from "./tools";
import type { AgentRuntimeInput } from "./types";

function parseToolCall(content: string): { tool: string; arguments: Record<string, unknown> } | null {
  const match = content.match(/\{[\s\S]*\}/)?.[0];
  if (!match) return null;
  try {
    const parsed = JSON.parse(match) as { type?: string; tool?: string; arguments?: Record<string, unknown> };
    if (parsed.type !== "tool_call" || typeof parsed.tool !== "string" || !parsed.arguments || typeof parsed.arguments !== "object") return null;
    return { tool: parsed.tool, arguments: parsed.arguments };
  } catch { return null; }
}

async function recordStep(executionId: string, seq: number, type: string, name: string, input: unknown, run: () => Promise<unknown>) {
  const step = await db.executionStep.create({ data: { executionId, seq, type, name, status: "RUNNING", input: JSON.stringify(input) } });
  try {
    const output = await run();
    await db.executionStep.update({ where: { id: step.id }, data: { status: "COMPLETED", output: JSON.stringify(output), completedAt: new Date() } });
    return output;
  } catch (error) {
    await db.executionStep.update({ where: { id: step.id }, data: { status: "FAILED", error: error instanceof Error ? error.message : "unknown error", completedAt: new Date() } }).catch(() => undefined);
    throw error;
  }
}

export async function runAgentExecution(input: AgentRuntimeInput) {
  const agent = await db.agent.findFirst({ where: { id: input.agentId, workspaceId: input.workspaceId, status: "active" } });
  if (!agent) throw Object.assign(new Error("ایجنت فعال پیدا نشد."), { status: 404 });

  const resolved = await llmManager.resolveForWorkspace(input.workspaceId);
  if (!resolved.provider) throw Object.assign(new Error("سرویس‌دهنده هوش مصنوعی پیکربندی نشده است."), { status: 503 });

  const tools = await listAgentTools(agent.id);
  const memories = agent.memoryEnabled ? await loadAgentMemory(agent.id, 8, input.conversationId) : [];
  const system = [agent.systemPrompt, agent.instructions, agent.persona, "نام ایجنت: " + agent.name,
    tools.length ? "اگر ابزار لازم است فقط JSON معتبر با type=tool_call برگردان. ابزارهای مجاز: " + tools.map(t => t.key + ": " + t.description + " schema=" + t.inputSchema).join(" | ") : "",
    memories.length ? "Memory:\n" + memories.map(m => m.key + ": " + m.value).join("\n") : ""].filter(Boolean).join("\n\n");
  const history = input.history.slice(-12);
  let execution: { id: string } | null = null;
  try { execution = await db.execution.create({ data: { workspaceId: input.workspaceId, agentId: agent.id, triggerType: "manual", status: "RUNNING", input: JSON.stringify(input.input) } }); } catch { execution = null; }

  try {
    let finalContent: string;
    let toolUsed: string | null = null;

    if (tools.length === 0) {
      const answer = await answerWithKnowledge({ agentId: agent.id, workspaceId: input.workspaceId, conversationId: input.conversationId, persona: agent, history, question: input.input });
      finalContent = answer.content;
    } else {
      let seq = 0;
      const planned = await recordStep(execution!.id, ++seq, "model", "Agent decision", { input: input.input },
        () => resolved.provider!.generateResponse({ messages: [{ role: "system", content: system }, ...history, { role: "user", content: input.input }], temperature: agent.temperature, maxTokens: agent.maxTokens }));
      const call = parseToolCall((planned as { content: string }).content);
      finalContent = (planned as { content: string }).content;
      if (call) {
        toolUsed = call.tool;
        const tool = tools.find(t => t.key === call.tool);
        if (!tool) throw new Error("Agent requested unavailable tool: " + call.tool);
        const result = await recordStep(execution!.id, ++seq, "tool", tool.name, call.arguments,
          () => executeTool(tool, call.arguments, { workspaceId: input.workspaceId, agentId: agent.id, conversationId: input.conversationId, executionId: execution!.id }));
        const final = await recordStep(execution!.id, ++seq, "model", "Final response", { tool: call.tool },
          () => resolved.provider!.generateResponse({ messages: [{ role: "system", content: system + "\n\nنتیجه ابزار را پردازش کن و پاسخ نهایی را تولید کن." }, ...history, { role: "user", content: input.input }, { role: "assistant", content: "Tool " + call.tool + " result: " + JSON.stringify(result) }], temperature: agent.temperature, maxTokens: agent.maxTokens }));
        finalContent = (final as { content: string }).content;
      }
      if (execution && agent.memoryEnabled) {
        await recordStep(execution.id, ++seq, "memory", "Memory update", { input: input.input }, async () => {
          await remember({ workspaceId: input.workspaceId, agentId: agent.id, conversationId: input.conversationId, key: "conversation:" + (input.conversationId ?? "manual") + ":last", value: input.input.slice(0, 1000), type: "interaction" });
          return { stored: true };
        }).catch(() => undefined);
      }
    }

    if (execution) {
      await db.execution.update({ where: { id: execution.id }, data: { status: "COMPLETED", output: finalContent, completedAt: new Date(), metadata: JSON.stringify({ provider: resolved.status.provider, model: resolved.status.model, toolUsed }) } }).catch(() => undefined);
    }
    return { executionId: execution?.id ?? "ephemeral", content: finalContent, provider: resolved.status.provider, model: resolved.status.model };
  } catch (error) {
    if (execution) await db.execution.update({ where: { id: execution.id }, data: { status: "FAILED", error: error instanceof Error ? error.message : "unknown error", completedAt: new Date() } }).catch(() => undefined);
    throw error;
  }
}
