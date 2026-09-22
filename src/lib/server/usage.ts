import { db } from '@/lib/db';
import { estimateTokens } from './audit';

interface UsageScope {
  dailyMessageLimit: number;
  monthlyMessageLimit: number;
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
}

async function enforceScope(
  where: Record<string, unknown>,
  limits: UsageScope,
  incomingMessages: number,
  incomingTokens: number,
  label: string,
) {
  if (
    limits.dailyMessageLimit <= 0 &&
    limits.monthlyMessageLimit <= 0 &&
    limits.dailyTokenLimit <= 0 &&
    limits.monthlyTokenLimit <= 0
  ) {
    return;
  }

  const now = new Date();
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);

  const [daily, monthly] = await Promise.all([
    db.usageEvent.aggregate({
      where: { ...where, createdAt: { gte: day } },
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
    db.usageEvent.aggregate({
      where: { ...where, createdAt: { gte: month } },
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
  ]);

  if (limits.dailyMessageLimit > 0 && daily._count._all + incomingMessages > limits.dailyMessageLimit) {
    throw Object.assign(new Error(`سقف پیام روزانه ${label} پر شده است.`), { status: 429 });
  }
  if (limits.monthlyMessageLimit > 0 && monthly._count._all + incomingMessages > limits.monthlyMessageLimit) {
    throw Object.assign(new Error(`سقف پیام ماهانه ${label} پر شده است.`), { status: 429 });
  }
  if (limits.dailyTokenLimit > 0 && (daily._sum.totalTokens ?? 0) + incomingTokens > limits.dailyTokenLimit) {
    throw Object.assign(new Error(`سقف توکن روزانه ${label} پر شده است.`), { status: 429 });
  }
  if (limits.monthlyTokenLimit > 0 && (monthly._sum.totalTokens ?? 0) + incomingTokens > limits.monthlyTokenLimit) {
    throw Object.assign(new Error(`سقف توکن ماهانه ${label} پر شده است.`), { status: 429 });
  }
}

export async function assertUsageWithinLimits(
  workspaceId: string,
  incomingMessages = 1,
  incomingTokens = 0,
  telegramUserId?: string,
) {
  const [policy, telegramUser] = await Promise.all([
    db.usagePolicy.findUnique({ where: { workspaceId } }),
    telegramUserId
      ? db.telegramUser.findUnique({
          where: { id: telegramUserId },
          select: {
            dailyMessageLimit: true,
            monthlyMessageLimit: true,
            dailyTokenLimit: true,
            monthlyTokenLimit: true,
          },
        })
      : null,
  ]);

  if (policy) {
    await enforceScope({ workspaceId }, policy, incomingMessages, incomingTokens, 'این فضای کاری');
  }

  if (telegramUser) {
    await enforceScope({ telegramUserId }, telegramUser, incomingMessages, incomingTokens, 'این کاربر تلگرام');
  }
}

export function tokenEstimateForMessages(messages: Array<{ content: string }>): number {
  return messages.reduce((sum, message) => sum + estimateTokens(message.content), 0);
}
