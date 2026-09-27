import { db } from "@/lib/db";
import { assertWorkspaceAccess, requireSession } from "@/lib/server/auth";
import { applyCors, jsonError, jsonOk, toErrorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const params = new URL(req.url).searchParams;
    const workspaceId = params.get("workspaceId") ?? session.memberships[0]?.workspaceId;
    const q = (params.get("q") ?? "").trim();

    if (!workspaceId) return jsonError("فضای کاری پیدا نشد.", 404);
    assertWorkspaceAccess(session, workspaceId);
    if (q.length < 2) return applyCors(jsonOk({ results: [] }), req.headers.get("origin"));
    if (q.length > 120) return applyCors(jsonError("عبارت جستجو بیش از حد طولانی است.", 400), req.headers.get("origin"));

    const contains = q.slice(0, 120);
    const [agents, knowledge, conversations] = await Promise.all([
      db.agent.findMany({
        where: { workspaceId, OR: [{ name: { contains, mode: "insensitive" } }, { description: { contains, mode: "insensitive" } }, { orgName: { contains, mode: "insensitive" } }] },
        select: { id: true, name: true, description: true },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      db.knowledgeSource.findMany({
        where: { agent: { workspaceId }, name: { contains } },
        select: { id: true, name: true, type: true, status: true, agentId: true, agent: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      db.conversation.findMany({
        where: { agent: { workspaceId }, title: { contains, mode: "insensitive" } },
        select: { id: true, title: true, channel: true, agentId: true, agent: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
    ]);

    return applyCors(jsonOk({
      results: [
        ...agents.map((x) => ({ type: "agent" as const, id: x.id, title: x.name, subtitle: x.description ?? "ایجنت", agentId: x.id })),
        ...knowledge.map((x) => ({ type: "knowledge" as const, id: x.id, title: x.name, subtitle: x.agent.name + " · " + x.status, agentId: x.agentId })),
        ...conversations.map((x) => ({ type: "conversation" as const, id: x.id, title: x.title, subtitle: x.agent.name + " · " + x.channel, agentId: x.agentId })),
      ],
    }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e, req.headers.get("origin"));
  }
}
