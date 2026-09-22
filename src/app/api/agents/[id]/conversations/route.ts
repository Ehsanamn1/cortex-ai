import { db } from "@/lib/db";
import { applyCors, jsonOk, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { loadAgentForSession } from "@/lib/server/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);
    const conversations = await db.conversation.findMany({
      where: { agentId: agent.id, channel: 'web', userId: session.user.id },
      include: { _count: { select: { messages: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return applyCors(
      jsonOk({
        conversations: conversations.map((c) => ({
          id: c.id,
          title: c.title,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          messageCount: c._count.messages,
        })),
      }),
      req.headers.get("origin")
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** POST — creates a NEW conversation (New Chat). Previous chats are preserved. */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);
    const conversation = await db.conversation.create({
      data: { agentId: agent.id, userId: session.user.id, title: "گفتگوی جدید" },
    });
    return applyCors(
      jsonOk(
        {
          conversation: {
            id: conversation.id,
            title: conversation.title,
            agentId: agent.id,
            createdAt: conversation.createdAt.toISOString(),
            updatedAt: conversation.updatedAt.toISOString(),
            messageCount: 0,
          },
        },
        201
      ),
      req.headers.get("origin")
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
