import { db } from '@/lib/db';
import { applyCors, jsonOk, toErrorResponse } from '@/lib/server/http';
import { requireSession } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

function dayStart() { const d = new Date(); d.setHours(0,0,0,0); return d; }

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const requestedWorkspaceId = new URL(req.url).searchParams.get("workspaceId");
    const workspaceId = requestedWorkspaceId ?? session.memberships[0]?.workspaceId;
    if (!workspaceId) {
      return applyCors(jsonOk({
        stats: { agents: 0, activeAgents: 0, knowledgeSources: 0, knowledgeReady: 0, conversations: 0, messages: 0, telegramBots: 0, totalUsageEvents: 0, totalTokens: 0, estimatedCostMicros: 0, todayMessages: 0, todayTokens: 0 },
        recentAgents: [],
        recentConversations: [],
        activity: [],
      }), req.headers.get('origin'));
    }
    const membership = session.memberships.find((m) => m.workspaceId === workspaceId);
    if (!membership) {
      const err = new Error("دسترسی به این فضای کاری ندارید.");
      (err as Error & { status?: number }).status = 403;
      throw err;
    }
    const agentFilter = { workspaceId };
    const [agents, activeAgents, knowledgeSources, knowledgeReady, conversations, messages, usage, telegramBots, recentAgents, recentConversations, audit] = await Promise.all([
      db.agent.count({ where: agentFilter }),
      db.agent.count({ where: { ...agentFilter, status: 'active' } }),
      db.knowledgeSource.count({ where: { agent: agentFilter } }),
      db.knowledgeSource.count({ where: { agent: agentFilter, status: 'ready' } }),
      db.conversation.count({ where: { agent: agentFilter } }),
      db.message.count({ where: { conversation: { agent: agentFilter } } }),
      db.usageEvent.aggregate({ where: { workspaceId }, _sum: { totalTokens: true, estimatedCostMicros: true }, _count: { _all: true } }),
      db.telegramBot.count({ where: { workspaceId } }),
      db.agent.findMany({ where: agentFilter, select: { id: true, name: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 5 }),
      db.conversation.findMany({ where: { agent: agentFilter }, select: { id: true, title: true, updatedAt: true, agent: { select: { id: true, name: true } } }, orderBy: { updatedAt: 'desc' }, take: 5 }),
      db.auditLog.findMany({ where: { workspaceId }, select: { id: true, action: true, entityType: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 6 })
    ]);
    const todayUsage = await db.usageEvent.aggregate({ where: { workspaceId, createdAt: { gte: dayStart() } }, _sum: { totalTokens: true }, _count: { _all: true } });
    return applyCors(jsonOk({
      stats: { agents, activeAgents, knowledgeSources, knowledgeReady, conversations, messages, telegramBots, totalUsageEvents: usage._count._all, totalTokens: usage._sum.totalTokens ?? 0, estimatedCostMicros: usage._sum.estimatedCostMicros ?? 0, todayMessages: todayUsage._count._all, todayTokens: todayUsage._sum.totalTokens ?? 0 },
      recentAgents: recentAgents.map(a => ({ id:a.id, name:a.name, updatedAt:a.updatedAt.toISOString() })),
      recentConversations: recentConversations.map(c => ({ id:c.id,title:c.title,agentId:c.agent.id,agentName:c.agent.name,updatedAt:c.updatedAt.toISOString() })),
      activity: audit.map(a => ({ id:a.id, action:a.action, entityType:a.entityType, createdAt:a.createdAt.toISOString() })),
    }), req.headers.get('origin'));
  } catch (e) { return toErrorResponse(e); }
}
