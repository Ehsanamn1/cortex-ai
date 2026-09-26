import { db } from "@/lib/db";
import { applyCors, corsPreflight, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { estimateTokens } from "@/lib/server/audit";
import { runAgentExecution } from "@/lib/runtime/engine";
import { reserveUsageWithinLimits, releaseUsageReservation } from "@/lib/server/usage";
import { authenticateAgentApiKey, readAgentApiKey } from "@/lib/server/agent-api-key";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}
type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  let reservationId: string | null = null;
  try {
    const agentId = (await params).id;
    const apiKey = readAgentApiKey(req);
    if (!apiKey) return applyCors(jsonError("API Key ارسال نشده است.", 401), req.headers.get("origin"));
    const auth = await authenticateAgentApiKey(apiKey);
    if (!auth || auth.agentId !== agentId) return applyCors(jsonError("API Key نامعتبر یا برای این ایجنت نیست.", 401), req.headers.get("origin"));
    rateLimit(req, "agent-api-" + auth.id, 60, 60000);

    const body = await readJson<Record<string, unknown>>(req);

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return applyCors(jsonError("فیلد message الزامی است.", 400), req.headers.get("origin"));
    if (message.length > 8000) return applyCors(jsonError("پیام بیش از حد طولانی است (حداکثر ۸۰۰۰ کاراکتر).", 400), req.headers.get("origin"));

    const clientId = (req.headers.get("x-cortex-client-id") ?? (typeof body.clientId === "string" ? body.clientId : "api-client")).trim().slice(0, 120) || "api-client";
    const requestedConversationId =
      req.headers.get("x-cortex-conversation-id") ??
      (typeof body.conversationId === "string" ? body.conversationId : "");
    const startNewChat = body.newChat === true;
    let conversation = !startNewChat && requestedConversationId
      ? await db.conversation.findFirst({ where: { id: requestedConversationId, agentId, channel: "api", externalUserId: clientId } })
      : null;
    if (!conversation && !startNewChat) {
      conversation = await db.conversation.findFirst({
        where: { agentId, channel: "api", externalUserId: clientId },
        orderBy: { updatedAt: "desc" },
      });
    }
    if (!conversation) conversation = await db.conversation.create({ data: { agentId, userId: null, title: "گفتگوی API", channel: "api", externalUserId: clientId } });

    const existing = await db.message.findMany({
      where: { conversationId: conversation.id, role: { in: ["user", "assistant"] } },
      orderBy: { createdAt: "desc" },
      take: 24,
    }).then((rows) => rows.reverse());
    const promptHistory = existing.slice(-12);
    const promptTokens = promptHistory.reduce((n, m) => n + estimateTokens(m.content), 0) + estimateTokens(message);

    reservationId = await reserveUsageWithinLimits(auth.agent.workspaceId, 1, promptTokens + 384, auth.agent.maxTokens);

    await db.message.create({ data: { conversationId: conversation.id, role: "user", content: message } });

    try {
      const runtime = await runAgentExecution({
        workspaceId: auth.agent.workspaceId,
        agentId,
        conversationId: conversation.id,
        memorySubjectKey: "api:" + agentId + ":" + clientId,
        input: message,
        history: promptHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      });

      const sources = (runtime.retrieval ?? []).map((r) => ({
        index: r.index,
        documentName: r.documentName,
        page: r.page ?? null,
        sourceUrl: r.sourceUrl ?? null,
      }));
      const retrieval = (runtime.retrieval ?? []).map((r) => ({
        index: r.index,
        score: Math.round(r.score * 1000) / 1000,
        documentName: r.documentName,
        page: r.page ?? null,
        sourceUrl: r.sourceUrl ?? null,
        snippet: r.text.slice(0, 220),
      }));

      const assistant = await db.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: runtime.content,
          metadata: JSON.stringify({
            executionId: runtime.executionId,
            sources,
            retrieval,
            provider: runtime.provider,
            model: runtime.model,
            latencyMs: runtime.latencyMs ?? 0,
            toolUsed: runtime.toolUsed ?? null,
          }),
        },
      });
      await db.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

      const inputTokens = promptTokens + (runtime.auxiliaryInputTokens ?? 0);
      const outputTokens = estimateTokens(runtime.content) + (runtime.auxiliaryOutputTokens ?? 0);
      const totalTokens = inputTokens + outputTokens;
      await db.$transaction([
        db.usageEvent.create({
          data: {
            workspaceId: auth.agent.workspaceId,
            agentId,
            channel: "api",
            provider: runtime.provider,
            model: runtime.model,
            inputTokens,
            outputTokens,
            totalTokens,
          },
        }),
        ...(reservationId ? [db.usageReservation.delete({ where: { id: reservationId } })] : []),
      ]);
      reservationId = null;

      return applyCors(jsonOk({
        id: assistant.id,
        conversationId: conversation.id,
        agent: { id: auth.agent.id, name: auth.agent.name },
        message: assistant.content,
        sources,
        usage: { inputTokens, outputTokens, totalTokens },
        execution: {
          id: runtime.executionId,
          provider: runtime.provider,
          model: runtime.model,
          latencyMs: runtime.latencyMs ?? 0,
          toolUsed: runtime.toolUsed ?? null,
        },
      }), req.headers.get("origin"));
    } catch (e) {
      await releaseUsageReservation(reservationId);
      reservationId = null;
      if (e && typeof e === "object" && "status" in e && Number((e as { status?: unknown }).status) === 503) {
        return applyCors(jsonError(e instanceof Error ? e.message : "سرویس پاسخ‌گویی در دسترس نیست.", 503), req.headers.get("origin"));
      }
      throw e;
    }
  } catch (e) {
    await releaseUsageReservation(reservationId);
    reservationId = null;
    return toErrorResponse(e, req.headers.get("origin"));
  }
}
