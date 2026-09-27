import { db } from "@/lib/db";
import { llmManager } from "@/lib/providers/llm/manager";
import type { ChatTurn } from "@/lib/providers/llm/types";
import { answerWithKnowledge } from "@/lib/rag/pipeline";
import type { RetrievedChunk } from "@/lib/rag/prompt";
import { loadAgentMemory, remember, rememberExplicitUserFacts } from "./memory";
import { executeTool, listAgentTools } from "./tools";
import type { AgentRuntimeInput } from "./types";
import { estimateTokens } from "@/lib/server/audit";
import { estimateLlmCostMicros } from "@/lib/server/pricing";
import {
  commitCreditReservation,
  getModelCreditMultiplier,
  providerCostToCredits,
  releaseCreditReservation,
  reserveCredits,
} from "@/lib/server/billing";

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

  let creditReservationId: string | null = null;

  try {
    let finalContent = "";
    let toolUsed: string | null = null;
    let retrieval: RetrievedChunk[] = [];
    let auxiliaryInputTokens = 0;
    let auxiliaryOutputTokens = 0;
    let measuredInputTokens = 0;
    let measuredOutputTokens = 0;
    let latencyMs = 0;

    const activeSubscription = await db.subscription.findFirst({
      where: { workspaceId: input.workspaceId, status: "ACTIVE" },
      select: { id: true },
    });

    if (activeSubscription) {
      const multiplier = await getModelCreditMultiplier(resolved.status.provider, resolved.status.model);
      const configuredInputReserve = Number(process.env.CORTEX_BILLING_INPUT_RESERVE_TOKENS ?? 6000);
      const baseInputEstimate =
        estimateTokens(system) +
        history.reduce((sum, item) => sum + estimateTokens(item.content), 0) +
        estimateTokens(input.input);
      const inputReservePerCall = Math.max(
        1,
        Number.isFinite(configuredInputReserve) && configuredInputReserve > 0
          ? Math.floor(configuredInputReserve)
          : 6000,
        baseInputEstimate,
      );
      const maxModelCalls = tools.length === 0 ? 2 : 4;
      const pessimisticInputTokens = inputReservePerCall * maxModelCalls;
      const pessimisticOutputTokens = Math.max(128, agent.maxTokens) * maxModelCalls;
      const pessimisticCostMicros = estimateLlmCostMicros(
        pessimisticInputTokens,
        pessimisticOutputTokens,
        resolved.status.provider,
        resolved.status.model,
      );
      const reservedCredits = providerCostToCredits(pessimisticCostMicros, multiplier);
      creditReservationId = await reserveCredits({
        workspaceId: input.workspaceId,
        amountCredits: reservedCredits,
        referenceType: "AGENT_EXECUTION",
        referenceId: execution?.id ?? null,
        idempotencyKey: "agent-execution:" + (execution?.id ?? globalThis.crypto.randomUUID()),
        ttlMs: 10 * 60_000,
      });
    }

    if (tools.length === 0) {
      await input.onProgress?.("🔎 در حال بررسی دانش و زمینه گفتگو…");
      const generationStartedAt = Date.now();
      const answer = await answerWithKnowledge({ agentId: agent.id, workspaceId: input.workspaceId, conversationId: input.conversationId, memorySubjectKey: input.memorySubjectKey, persona: agent, history, question: input.input });
      finalContent = answer.content;
      retrieval = answer.retrieval;
      auxiliaryInputTokens = answer.auxiliaryInputTokens ?? 0;
      auxiliaryOutputTokens = answer.auxiliaryOutputTokens ?? 0;
      measuredInputTokens = (answer.promptInputTokens ?? 0) + auxiliaryInputTokens;
      measuredOutputTokens = (answer.completionOutputTokens ?? estimateTokens(answer.content)) + auxiliaryOutputTokens;
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
        measuredInputTokens += modelMessages.reduce((sum, message) => sum + estimateTokens(message.content), 0);
        measuredOutputTokens += estimateTokens(plannedContent);
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
        measuredOutputTokens += estimateTokens(finalContent);
      }
      await input.onProgress?.("✍️ در حال جمع‌بندی پاسخ نهایی…");
      if (agent.memoryEnabled) {
        await recordStep(execution?.id ?? null, ++seq, "memory", "Memory update", { input: input.input }, async () => {
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

    if (creditReservationId) {
      const multiplier = await getModelCreditMultiplier(resolved.status.provider, resolved.status.model);
      const providerCostMicros = estimateLlmCostMicros(
        measuredInputTokens,
        measuredOutputTokens,
        resolved.status.provider,
        resolved.status.model,
      );
      const actualCredits = providerCostToCredits(providerCostMicros, multiplier);
      await commitCreditReservation(creditReservationId, actualCredits);
      creditReservationId = null;
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
    await releaseCreditReservation(creditReservationId);
    creditReservationId = null;
    if (execution) await db.execution.update({ where: { id: execution.id }, data: { status: "FAILED", error: error instanceof Error ? error.message : "unknown error", completedAt: new Date() } }).catch(() => undefined);
    throw error;
  }
}
