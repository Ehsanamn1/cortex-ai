import { db } from '@/lib/db';
import { applyCors, jsonOk, toErrorResponse } from '@/lib/server/http';
import { requireSession } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

function dayStart() { const d = new Date(); d.setHours(0,0,0,0); return d; }

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const requestedWorkspaceId = new URL(req.url).searchParams.get('workspaceId');
    const workspaceId = requestedWorkspaceId ?? session.memberships[0]?.workspaceId;

    if (!workspaceId) {
      return applyCors(jsonOk({
        stats: { agents:0, activeAgents:0, knowledgeSources:0, knowledgeReady:0, conversations:0, messages:0, telegramBots:0, totalUsageEvents:0, totalTokens:0, estimatedCostMicros:0, todayMessages:0, todayTokens:0 },
        recentAgents:[], recentConversations:[], activity:[]
      }), req.headers.get('origin'));
    }

    const membership = session.memberships.find((m) => m.workspaceId === workspaceId);
    if (!membership) {
      const err = new Error('دسترسی به این فضای کاری ندارید.');
      (err as Error & { status?: number }).status = 403;
      throw err;
    }

    const agentFilter = { workspaceId };
    async function safe<T>(operation: () => Promise<T>, fallback: T, label: string): Promise<T> {
      try {
        return await operation();
      } catch (error) {
        console.error('[cortex][dashboard] ' + label + ' failed:', error);
        return fallback;
      }
    }

    const [agents, activeAgents, knowledgeSources, knowledgeReady, conversations, messages, usage, telegramBots, recentAgents, recentConversations, audit, todayUsage] =
      await Promise.all([
        safe(() => db.agent.count({ where: agentFilter }), 0, 'agents'),
        safe(() => db.agent.count({ where: { ...agentFilter, status: 'active' } }), 0, 'active agents'),
        safe(() => db.knowledgeSource.count({ where: { agent: agentFilter } }), 0, 'knowledge'),
        safe(() => db.knowledgeSource.count({ where: { agent: agentFilter, status: 'ready' } }), 0, 'knowledge ready'),
        safe(() => db.conversation.count({ where: { agent: agentFilter } }), 0, 'conversations'),
        safe(() => db.message.count({ where: { conversation: { agent: agentFilter } } }), 0, 'messages'),
        safe(
          () => db.usageEvent.aggregate({ where: { workspaceId }, _sum: { totalTokens: true, estimatedCostMicros: true }, _count: { _all: true } }),
          { _count: { _all: 0 }, _sum: { totalTokens: 0, estimatedCostMicros: 0 } },
          'usage'
        ),
        safe(() => db.telegramBot.count({ where: { workspaceId } }), 0, 'telegram'),
        safe(
          () => db.agent.findMany({ where: agentFilter, select: { id: true, name: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 5 }),
          [],
          'recent agents'
        ),
        safe(
          () => db.conversation.findMany({ where: { agent: agentFilter }, select: { id: true, title: true, updatedAt: true, agent: { select: { id: true, name: true } } }, orderBy: { updatedAt: 'desc' }, take: 5 }),
          [],
          'recent conversations'
        ),
        safe(
          () => db.auditLog.findMany({ where: { workspaceId }, select: { id: true, action: true, entityType: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 6 }),
          [],
          'audit'
        ),
        safe(
          () => db.usageEvent.aggregate({ where: { workspaceId, createdAt: { gte: dayStart() } }, _sum: { totalTokens: true }, _count: { _all: true } }),
          { _count: { _all: 0 }, _sum: { totalTokens: 0 } },
          'today usage'
        )
      ]);

    // Keep the dashboard response deliberately JSON-safe. A single malformed
    // record must never turn the whole endpoint into HTTP 500.
    const iso = (value: unknown) => {
      if (value instanceof Date) return value.toISOString();
      const parsed = new Date(String(value));
      return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
    };

    const payload = {
      stats: {
        agents: Number(agents) || 0,
        activeAgents: Number(activeAgents) || 0,
        knowledgeSources: Number(knowledgeSources) || 0,
        knowledgeReady: Number(knowledgeReady) || 0,
        conversations: Number(conversations) || 0,
        messages: Number(messages) || 0,
        telegramBots: Number(telegramBots) || 0,
        totalUsageEvents: Number(usage?._count?._all) || 0,
        totalTokens: Number(usage?._sum?.totalTokens) || 0,
        estimatedCostMicros: Number(usage?._sum?.estimatedCostMicros) || 0,
        todayMessages: Number(todayUsage?._count?._all) || 0,
        todayTokens: Number(todayUsage?._sum?.totalTokens) || 0
      },
      recentAgents: Array.isArray(recentAgents)
        ? recentAgents.map((a) => ({ id: String(a.id), name: String(a.name ?? ''), updatedAt: iso(a.updatedAt) }))
        : [],
      recentConversations: Array.isArray(recentConversations)
        ? recentConversations.map((item) => ({
            id: String(item.id),
            title: String(item.title ?? ''),
            agentId: String(item.agent?.id ?? ''),
            agentName: String(item.agent?.name ?? ''),
            updatedAt: iso(item.updatedAt)
          }))
        : [],
      activity: Array.isArray(audit)
        ? audit.map((a) => ({
            id: String(a.id),
            action: String(a.action ?? ''),
            entityType: String(a.entityType ?? ''),
            createdAt: iso(a.createdAt)
          }))
        : []
    };

    return applyCors(jsonOk(payload), req.headers.get('origin'));
  } catch (e) {
    // Last-resort dashboard contract: never expose an internal 500 to the UI
    // for a non-authentication data failure. Authentication/authorization
    // errors still retain their explicit 401/403 status.
    const status = Number((e as { status?: unknown })?.status);
    if (status === 401 || status === 403 || status === 503) return toErrorResponse(e);
    console.error('[cortex][dashboard] unhandled dashboard failure:', e);
    return applyCors(jsonOk({
      stats: {
        agents: 0, activeAgents: 0, knowledgeSources: 0, knowledgeReady: 0,
        conversations: 0, messages: 0, telegramBots: 0, totalUsageEvents: 0,
        totalTokens: 0, estimatedCostMicros: 0, todayMessages: 0, todayTokens: 0
      },
      recentAgents: [], recentConversations: [], activity: []
    }), req.headers.get('origin'));
  }
}
