import { db } from "@/lib/db";
import { applyCors, corsPreflight, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { estimateTokens } from "@/lib/server/audit";
import { authenticateAgentApiKey, readAgentApiKey } from "@/lib/server/agent-api-key";
import { answerWithKnowledge, RagConfigError, toRetrievalDebug, toSourceRefs } from "@/lib/rag/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export function OPTIONS(req: Request) {
  return corsPreflight(req);
}
type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
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
    const userMessage = await db.message.create({ data: { conversationId: conversation.id, role: "user", content: message } });

    try {
      const answer = await answerWithKnowledge({
        agentId,
        workspaceId: auth.agent.workspaceId,
        persona: auth.agent,
        history: promptHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        question: message,
      });
      const metadata = { sources: toSourceRefs(answer.retrieval), retrieval: toRetrievalDebug(answer.retrieval), provider: answer.provider, model: answer.model, latencyMs: answer.latencyMs };
      const assistant = await db.message.create({ data: { conversationId: conversation.id, role: "assistant", content: answer.content, metadata: JSON.stringify(metadata) } });
      await db.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
      const inputTokens = promptTokens + (answer.auxiliaryInputTokens ?? 0);
      const outputTokens = estimateTokens(answer.content) + (answer.auxiliaryOutputTokens ?? 0);
      const totalTokens = inputTokens + outputTokens;
      await db.usageEvent.create({ data: { workspaceId: auth.agent.workspaceId, agentId, channel: "api", provider: answer.provider, model: answer.model, inputTokens, outputTokens, totalTokens } });
      return applyCors(jsonOk({
        id: assistant.id,
        conversationId: conversation.id,
        agent: { id: auth.agent.id, name: auth.agent.name },
        message: assistant.content,
        sources: metadata.sources,
        usage: { inputTokens, outputTokens, totalTokens },
      }), req.headers.get("origin"));
    } catch (e) {
      if (e instanceof RagConfigError) return applyCors(jsonError(e.message, 503), req.headers.get("origin"));
      throw e;
    }
  } catch (e) { return toErrorResponse(e, req.headers.get("origin")); }
}
