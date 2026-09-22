import { db } from '@/lib/db';
import { applyCors, jsonOk, toErrorResponse } from '@/lib/server/http';
import { requireSession } from '@/lib/server/auth';
import { agentFilterForSession } from '@/lib/server/access';

export const dynamic = 'force-dynamic';

function dayStart() { const d = new Date(); d.setHours(0,0,0,0); return d; }

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const agentFilter = agentFilterForSession(session);
    const [agents, activeAgents, knowledgeSources, knowledgeReady, conversations, messages, usage, telegramBots, recentAgents, recentConversations, audit] = await Promise.all([
      db.agent.count({ where: agentFilter }),
      db.agent.count({ where: { ...agentFilter, status: 'active' } }),
      db.knowledgeSource.count({ where: { agent: agentFilter } }),
      db.knowledgeSource.count({ where: { agent: agentFilter, status: 'ready' } }),
      db.conversation.count({ where: { agent: agentFilter } }),
      db.message.count({ where: { conversation: { agent: agentFilter } } }),
      db.usageEvent.aggregate({ where: { workspaceId: { in: session.memberships.map(m => m.workspaceId) } }, _sum: { totalTokens: true, estimatedCostMicros: true }, _count: { _all: true } }),
      db.telegramBot.count({ where: { workspaceId: { in: session.memberships.map(m => m.workspaceId) } } }),
      db.agent.findMany({ where: agentFilter, select: { id: true, name: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 5 }),
      db.conversation.findMany({ where: { agent: agentFilter }, select: { id: true, title: true, updatedAt: true, agent: { select: { id: true, name: true } } }, orderBy: { updatedAt: 'desc' }, take: 5 }),
      db.auditLog.findMany({ where: { workspaceId: { in: session.memberships.map(m => m.workspaceId) } }, select: { id: true, action: true, entityType: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 6 })
    ]);
    const todayUsage = await db.usageEvent.aggregate({ where: { workspaceId: { in: session.memberships.map(m => m.workspaceId) }, createdAt: { gte: dayStart() } }, _sum: { totalTokens: true }, _count: { _all: true } });
    return applyCors(jsonOk({
      stats: { agents, activeAgents, knowledgeSources, knowledgeReady, conversations, messages, telegramBots, totalUsageEvents: usage._count._all, totalTokens: usage._sum.totalTokens ?? 0, estimatedCostMicros: usage._sum.estimatedCostMicros ?? 0, todayMessages: todayUsage._count._all, todayTokens: todayUsage._sum.totalTokens ?? 0 },
      recentAgents: recentAgents.map(a => ({ id:a.id, name:a.name, updatedAt:a.updatedAt.toISOString() })),
      recentConversations: recentConversations.map(c => ({ id:c.id,title:c.title,agentId:c.agent.id,agentName:c.agent.name,updatedAt:c.updatedAt.toISOString() })),
      activity: audit.map(a => ({ id:a.id, action:a.action, entityType:a.entityType, createdAt:a.createdAt.toISOString() })),
    }), req.headers.get('origin'));
  } catch (e) { return toErrorResponse(e); }
}
