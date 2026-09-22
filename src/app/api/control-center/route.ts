import { db } from "@/lib/db";
import { applyCors, jsonOk, toErrorResponse } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    const [users, workspaces, agents, knowledge, conversations, messages, bots, providers, events, logs, recentAgents, recentUsers, recentConversations] = await Promise.all([
      db.user.count(),
      db.workspace.count(),
      db.agent.count(),
      db.knowledgeSource.count(),
      db.conversation.count(),
      db.message.count(),
      db.telegramBot.count(),
      db.providerConfig.count({ where: { enabled: true } }),
      db.usageEvent.count(),
      db.auditLog.count(),
      db.agent.findMany({ take: 8, orderBy: { createdAt: "desc" }, select: { id:true,name:true,status:true,createdAt:true,workspace:{select:{name:true}} } }),
      db.user.findMany({ take: 8, orderBy: { createdAt: "desc" }, select: { id:true,name:true,email:true,createdAt:true } }),
      db.conversation.findMany({ take: 8, orderBy: { updatedAt: "desc" }, select: { id:true,title:true,channel:true,updatedAt:true,agent:{select:{name:true}} } }),
    ]);

    return applyCors(jsonOk({
      admin,
      metrics: { users, workspaces, agents, knowledge, conversations, messages, bots, providers, events, logs },
      recentAgents: recentAgents.map((x) => ({ ...x, createdAt:x.createdAt.toISOString() })),
      recentUsers: recentUsers.map((x) => ({ ...x, createdAt:x.createdAt.toISOString() })),
      recentConversations: recentConversations.map((x) => ({ ...x, updatedAt:x.updatedAt.toISOString() })),
    }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
