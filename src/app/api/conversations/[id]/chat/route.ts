import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { loadAgentForSession } from "@/lib/server/access";
import { rateLimit } from "@/lib/server/rate-limit";
import { releaseUsageReservation, reserveUsageWithinLimits } from "@/lib/server/usage";
import { estimateTokens } from "@/lib/server/audit";
import { runAgentExecution } from "@/lib/runtime/engine";
import { RAG_QUERY_EXPANSION_RESERVE_TOKENS, toRetrievalDebug, toSourceRefs } from "@/lib/rag/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };
const MAX_QUESTION_CHARS = 4000;

export async function POST(req: Request, { params }: Params) {
  let reservationId: string | null = null;

  try {
    const session = await requireSession(req);
    const { id } = await params;
    rateLimit(req, "chat", 30, 60_000);

    const conversation = await db.conversation.findUnique({
      where: { id },
      include: { agent: true },
    });
    if (!conversation) {
      return applyCors(jsonError("گفتگو یافت نشد.", 404), req.headers.get("origin"));
    }

    const agent = await loadAgentForSession(session, conversation.agentId);

    if (conversation.channel === "web" && conversation.userId !== session.user.id) {
      return applyCors(jsonError("دسترسی به این گفتگو مجاز نیست.", 403), req.headers.get("origin"));
    }

    const body = await readJson<{ content?: unknown }>(req);
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) {
      return applyCors(jsonError("متن پیام خالی است.", 400), req.headers.get("origin"));
    }
    if (content.length > MAX_QUESTION_CHARS) {
      return applyCors(
        jsonError(`متن پیام بیش از حد طولانی است (حداکثر ${MAX_QUESTION_CHARS} کاراکتر).`, 400),
        req.headers.get("origin"),
      );
    }

    const existingMessages = await db.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 24,
    }).then((rows) => rows.reverse());

    const history = existingMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-12)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const estimatedPromptTokens =
      history.reduce((sum, item) => sum + estimateTokens(item.content), 0) +
      estimateTokens(content);

    reservationId = await reserveUsageWithinLimits(
      agent.workspaceId,
      1,
      estimatedPromptTokens + RAG_QUERY_EXPANSION_RESERVE_TOKENS,
      agent.maxTokens,
    );

    const userMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content,
      },
    });

    if (existingMessages.length === 0) {
      await db.conversation.update({
        where: { id: conversation.id },
        data: {
          title: content.length > 42 ? `${content.slice(0, 42)}…` : content,
        },
      });
    }

    const runtime = await runAgentExecution({
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      input: content,
      conversationId: conversation.id,
      memorySubjectKey: "web:" + session.user.id,
      history,
    });

    const retrieval = runtime.retrieval ?? [];
    const metadata = {
      executionId: runtime.executionId,
      sources: toSourceRefs(retrieval),
      retrieval: toRetrievalDebug(retrieval),
      provider: runtime.provider,
      model: runtime.model,
      latencyMs: runtime.latencyMs ?? 0,
      toolUsed: runtime.toolUsed ?? null,
    };

    const assistantMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: runtime.content,
        metadata: JSON.stringify(metadata),
      },
    });

    await db.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    const inputTokens = estimatedPromptTokens + (runtime.auxiliaryInputTokens ?? 0);
    const outputTokens = estimateTokens(runtime.content) + (runtime.auxiliaryOutputTokens ?? 0);

    await db.$transaction([
      db.usageEvent.create({
        data: {
          workspaceId: agent.workspaceId,
          agentId: agent.id,
          userId: session.user.id,
          channel: "web",
          provider: runtime.provider,
          model: runtime.model,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
      }),
      ...(reservationId
        ? [db.usageReservation.delete({ where: { id: reservationId } })]
        : []),
    ]);
    reservationId = null;

    return applyCors(
      jsonOk({
        userMessage: {
          id: userMessage.id,
          role: "user",
          content: userMessage.content,
          createdAt: userMessage.createdAt.toISOString(),
          metadata: null,
        },
        assistantMessage: {
          id: assistantMessage.id,
          role: "assistant",
          content: assistantMessage.content,
          createdAt: assistantMessage.createdAt.toISOString(),
          metadata,
        },
      }),
      req.headers.get("origin"),
    );
  } catch (error) {
    await releaseUsageReservation(reservationId);
    reservationId = null;
    return toErrorResponse(error, req.headers.get("origin"));
  }
}
