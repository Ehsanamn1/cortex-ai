import { db } from "@/lib/db";
import { applyCors, jsonOk, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { loadAgentForSession } from "@/lib/server/access";

export const dynamic = "force-dynamic";

const FALLBACK_MARKER = "اطلاعات کافی در دانش فعلی برای پاسخ دقیق به این سؤال پیدا نکردم.";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);

    const [usage, conversations, messages, telegramUsers, knowledge, onboarding, recentUsage, userMessages, assistantMessages] = await Promise.all([
      db.usageEvent.aggregate({
        where: { agentId: agent.id },
        _count: { _all: true },
        _sum: { totalTokens: true, inputTokens: true, outputTokens: true, estimatedCostMicros: true },
      }),
      db.conversation.count({ where: { agentId: agent.id } }),
      db.message.count({ where: { conversation: { agentId: agent.id } } }),
      db.telegramUser.count({ where: { bot: { agentId: agent.id } } }),
      db.knowledgeSource.findMany({ where: { agentId: agent.id }, select: { status: true } }),
      db.agentOnboardingSession.findFirst({
        where: { agentId: agent.id, status: "completed" },
        orderBy: { completedAt: "desc" },
        select: { id: true },
      }),
      db.usageEvent.findMany({
        where: { agentId: agent.id },
        select: { createdAt: true, totalTokens: true },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      db.message.findMany({
        where: { conversation: { agentId: agent.id }, role: "user" },
        select: { conversationId: true, content: true },
        orderBy: { createdAt: "desc" },
        take: 3000,
      }),
      db.message.findMany({
        where: { conversation: { agentId: agent.id }, role: "assistant" },
        select: { conversationId: true, content: true },
        orderBy: { createdAt: "desc" },
        take: 3000,
      }),
    ]);

    const trendMap = new Map<string, { date: string; requests: number; tokens: number }>();
    for (const row of recentUsage) {
      const date = row.createdAt.toISOString().slice(0, 10);
      const current = trendMap.get(date) ?? { date, requests: 0, tokens: 0 };
      current.requests += 1;
      current.tokens += row.totalTokens;
      trendMap.set(date, current);
    }

    const questions = new Map<string, number>();
    for (const row of userMessages) {
      const question = row.content.trim().replace(/s+/g, " ");
      if (question) questions.set(question, (questions.get(question) ?? 0) + 1);
    }

    const latestUserByConversation = new Map<string, string>();
    for (const row of userMessages) {
      if (!latestUserByConversation.has(row.conversationId)) {
        latestUserByConversation.set(row.conversationId, row.content.trim().replace(/s+/g, " "));
      }
    }

    const unansweredCounts = new Map<string, number>();
    for (const message of assistantMessages) {
      if (!message.content.includes(FALLBACK_MARKER)) continue;
      const question = latestUserByConversation.get(message.conversationId) ?? "سؤال بدون پاسخ متکی به دانش کافی";
      unansweredCounts.set(question, (unansweredCounts.get(question) ?? 0) + 1);
    }

    return applyCors(jsonOk({
      conversations,
      messages,
      telegramUsers,
      usage: {
        events: usage._count._all,
        totalTokens: usage._sum.totalTokens ?? 0,
        inputTokens: usage._sum.inputTokens ?? 0,
        outputTokens: usage._sum.outputTokens ?? 0,
        estimatedCostMicros: usage._sum.estimatedCostMicros ?? 0,
      },
      knowledge: {
        sources: knowledge.length,
        ready: knowledge.filter((x) => x.status === "ready").length,
        onboardingComplete: Boolean(onboarding),
      },
      trend: [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14),
      topQuestions: [...questions.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([question, count]) => ({ question, count })),
      unanswered: [...unansweredCounts.values()].reduce((sum, count) => sum + count, 0),
      unansweredQuestions: [...unansweredCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([question, count]) => ({ question, count })),
    }), req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}
