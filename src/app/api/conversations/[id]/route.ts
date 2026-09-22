import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { loadAgentForSession, serializeAgent } from "@/lib/server/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const conversation = await db.conversation.findUnique({
      where: { id },
      include: { agent: { include: { _count: { select: { knowledgeSources: true, conversations: true } } } } },
    });
    if (!conversation) {
      return applyCors(jsonError("گفتگو یافت نشد.", 404), req.headers.get("origin"));
    }
    await loadAgentForSession(session, conversation.agentId);
    if (conversation.channel === 'web' && conversation.userId !== session.user.id) {
      return applyCors(jsonError('دسترسی به این گفتگو مجاز نیست.', 403), req.headers.get('origin'));
    }

    const messages = await db.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });

    return applyCors(
      jsonOk({
        conversation: {
          id: conversation.id,
          title: conversation.title,
          agentId: conversation.agentId,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
          messageCount: messages.length,
        },
        agent: serializeAgent(conversation.agent, conversation.agent._count),
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          metadata: m.metadata ? safeParse(m.metadata) : null,
        })),
      }),
      req.headers.get("origin")
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const conversation = await db.conversation.findUnique({ where: { id } });
    if (!conversation) {
      return applyCors(jsonError("گفتگو یافت نشد.", 404), req.headers.get("origin"));
    }
    await loadAgentForSession(session, conversation.agentId);
    if (conversation.channel === 'web' && conversation.userId !== session.user.id) {
      return applyCors(jsonError('دسترسی به این گفتگو مجاز نیست.', 403), req.headers.get('origin'));
    }
    await db.conversation.delete({ where: { id: conversation.id } });
    return applyCors(jsonOk({ ok: true }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
