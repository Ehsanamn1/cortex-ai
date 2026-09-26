import { db } from "@/lib/db";
import { llmManager } from "@/lib/providers/llm/manager";
import type { ChatTurn } from "@/lib/providers/llm/types";
import { answerWithKnowledge } from "@/lib/rag/pipeline";
import type { RetrievedChunk } from "@/lib/rag/prompt";
import { loadAgentMemory, remember, rememberExplicitUserFacts } from "./memory";
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

async function recordStep(executionId: string | null, seq: number, type: string, name: string, input: unknown, run: () => Promise<unknown>) {
  if (!executionId) return run();
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

  const resolved = await llmManager.resolveForAgent(agent.id, input.workspaceId);
  if (!resolved.provider) throw Object.assign(new Error("سرویس‌دهنده هوش مصنوعی برای این ایجنت پیکربندی نشده است. از تب «هوش مصنوعی» ایجنت استفاده کنید."), { status: 503 });

  const tools = await listAgentTools(agent.id);
  const memories = agent.memoryEnabled ? await loadAgentMemory(agent.id, 12, input.conversationId, input.memorySubjectKey) : [];
  const system = [agent.systemPrompt, agent.instructions, agent.persona, "نام ایجنت: " + agent.name,
    tools.length ? "اگر ابزار لازم است فقط JSON معتبر با type=tool_call برگردان. ابزارهای مجاز: " + tools.map(t => t.key + ": " + t.description + " schema=" + t.inputSchema).join(" | ") : "",
    memories.length ? "Memory:\n" + memories.map(m => m.key + ": " + m.value).join("\n") : ""].filter(Boolean).join("\n\n");
  const history = input.history.slice(-12);
  let execution: { id: string } | null = null;
  try { execution = await db.execution.create({ data: { workspaceId: input.workspaceId, agentId: agent.id, triggerType: "manual", status: "RUNNING", input: JSON.stringify(input.input) } }); } catch { execution = null; }

  try {
    let finalContent = "";
    let toolUsed: string | null = null;
    let retrieval: RetrievedChunk[] = [];
    let auxiliaryInputTokens = 0;
    let auxiliaryOutputTokens = 0;
    let latencyMs = 0;

    if (tools.length === 0) {
      await input.onProgress?.("🔎 در حال بررسی دانش و زمینه گفتگو…");
      const generationStartedAt = Date.now();
      const answer = await answerWithKnowledge({ agentId: agent.id, workspaceId: input.workspaceId, conversationId: input.conversationId, memorySubjectKey: input.memorySubjectKey, persona: agent, history, question: input.input });
      finalContent = answer.content;
      retrieval = answer.retrieval;
      auxiliaryInputTokens = answer.auxiliaryInputTokens ?? 0;
      auxiliaryOutputTokens = answer.auxiliaryOutputTokens ?? 0;
      latencyMs = answer.latencyMs || (Date.now() - generationStartedAt);
    } else {
      let seq = 0;
      const modelMessages: ChatTurn[] = [
        { role: "system", content: system },
        ...history,
        { role: "user", content: input.input },
      ];
      for (let iteration = 0; iteration < 4; iteration++) {
        await input.onProgress?.(iteration === 0 ? "🧠 در حال فکر کردن و برنامه‌ریزی…" : "🛠️ در حال ادامه کار ایجنت…");
        const planned = await recordStep(execution?.id ?? null, ++seq, "model", iteration === 0 ? "Agent decision" : "Agent continuation", { input: input.input, iteration },
          () => resolved.provider!.generateResponse({
            messages: modelMessages,
            temperature: agent.temperature,
            maxTokens: agent.maxTokens,
          }));
        const plannedContent = (planned as { content: string }).content;
        const call = parseToolCall(plannedContent);
        if (!call) {
          finalContent = plannedContent;
          break;
        }
        toolUsed = call.tool;
        const tool = tools.find(t => t.key === call.tool);
        if (!tool) throw new Error("Agent requested unavailable tool: " + call.tool);
        await input.onProgress?.("⚙️ در حال اجرای «" + tool.name + "»…");
        const result = await recordStep(execution?.id ?? null, ++seq, "tool", tool.name, call.arguments,
          () => executeTool(tool, call.arguments, { workspaceId: input.workspaceId, agentId: agent.id, conversationId: input.conversationId, executionId: execution?.id ?? "ephemeral" }));
        modelMessages.push(
          { role: "assistant", content: plannedContent },
          { role: "user", content: "نتیجه ابزار " + call.tool + ": " + JSON.stringify(result).slice(0, 12000) + "\nادامه بده؛ اگر کار تمام شده پاسخ نهایی عادی بده و اگر ابزار دیگری لازم است tool_call بده." },
        );
      }
      if (!finalContent) {
        finalContent = "✅ کار انجام شد. برای ادامه، جزئیات بیشتری لازم دارم.";
      }
      await input.onProgress?.("✍️ در حال جمع‌بندی پاسخ نهایی…");
      if (execution && agent.memoryEnabled) {
        await recordStep(execution.id, ++seq, "memory", "Memory update", { input: input.input }, async () => {
          await remember({
            workspaceId: input.workspaceId,
            agentId: agent.id,
            conversationId: input.conversationId,
            key: "conversation:" + (input.conversationId ?? "manual") + ":last",
            value: input.input.slice(0, 1000),
            type: "interaction",
          });
          if (input.memorySubjectKey) {
            await rememberExplicitUserFacts({
              workspaceId: input.workspaceId,
              agentId: agent.id,
              subjectKey: input.memorySubjectKey,
              text: input.input,
            });
          }
          return { stored: true };
        }).catch(() => undefined);
      }
    }

    if (execution) {
      await db.execution.update({ where: { id: execution.id }, data: { status: "COMPLETED", output: finalContent, completedAt: new Date(), metadata: JSON.stringify({ provider: resolved.status.provider, model: resolved.status.model, toolUsed }) } }).catch(() => undefined);
    }
    return {
      executionId: execution?.id ?? "ephemeral",
      content: finalContent,
      provider: resolved.status.provider,
      model: resolved.status.model,
      retrieval,
      auxiliaryInputTokens,
      auxiliaryOutputTokens,
      latencyMs,
      toolUsed,
    };
  } catch (error) {
    if (execution) await db.execution.update({ where: { id: execution.id }, data: { status: "FAILED", error: error instanceof Error ? error.message : "unknown error", completedAt: new Date() } }).catch(() => undefined);
    throw error;
  }
}
