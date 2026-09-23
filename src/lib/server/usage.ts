import { db } from "@/lib/db";
import { estimateTokens } from "./audit";

interface UsageScope {
  dailyMessageLimit: number;
  monthlyMessageLimit: number;
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
}

function hasLimits(limits: UsageScope): boolean {
  return (
    limits.dailyMessageLimit > 0 ||
    limits.monthlyMessageLimit > 0 ||
    limits.dailyTokenLimit > 0 ||
    limits.monthlyTokenLimit > 0
  );
}

function assertScopeWithinLimits(
  limits: UsageScope,
  totals: {
    dailyMessages: number;
    monthlyMessages: number;
    dailyTokens: number;
    monthlyTokens: number;
  },
  incomingMessages: number,
  incomingTokens: number,
  label: string,
) {
  if (limits.dailyMessageLimit > 0 && totals.dailyMessages + incomingMessages > limits.dailyMessageLimit) {
    throw Object.assign(new Error(`سقف پیام روزانه ${label} پر شده است.`), { status: 429 });
  }
  if (limits.monthlyMessageLimit > 0 && totals.monthlyMessages + incomingMessages > limits.monthlyMessageLimit) {
    throw Object.assign(new Error(`سقف پیام ماهانه ${label} پر شده است.`), { status: 429 });
  }
  if (limits.dailyTokenLimit > 0 && totals.dailyTokens + incomingTokens > limits.dailyTokenLimit) {
    throw Object.assign(new Error(`سقف توکن روزانه ${label} پر شده است.`), { status: 429 });
  }
  if (limits.monthlyTokenLimit > 0 && totals.monthlyTokens + incomingTokens > limits.monthlyTokenLimit) {
    throw Object.assign(new Error(`سقف توکن ماهانه ${label} پر شده است.`), { status: 429 });
  }
}

/**
 * Reserve the request's message + token budget before generation.
 *
 * The reservation is durable in PostgreSQL and protected by a transaction-scoped
 * advisory lock, so concurrent Worker isolates cannot both pass the same quota.
 * maxOutputTokens is reserved pessimistically because the provider call happens
 * after the quota decision and the final output length is not known yet.
 */
export async function reserveUsageWithinLimits(
  workspaceId: string,
  incomingMessages = 1,
  incomingTokens = 0,
  maxOutputTokens = 0,
  telegramUserId?: string,
): Promise<string | null> {
  const reservationTokens = Math.max(0, Math.floor(incomingTokens)) + Math.max(0, Math.floor(maxOutputTokens));
  const reservationId = crypto.randomUUID();
  const now = new Date();
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const expiresAt = new Date(now.getTime() + 5 * 60_000);

  const reserved = await db.$transaction(async (tx) => {
    // Serialize all quota decisions in this workspace. Telegram user limits
    // get their own lock too; lock ordering is always workspace → user.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}))`;
    if (telegramUserId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${telegramUserId}))`;
    }

    // Expired reservations cannot consume quota anymore.
    await tx.usageReservation.deleteMany({ where: { expiresAt: { lte: now } } });

    const [policy, telegramUser] = await Promise.all([
      tx.usagePolicy.findUnique({ where: { workspaceId } }),
      telegramUserId
        ? tx.telegramUser.findUnique({
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

    const workspaceLimits: UsageScope | null = policy
      ? {
          dailyMessageLimit: Math.max(0, policy.dailyMessageLimit),
          monthlyMessageLimit: Math.max(0, policy.monthlyMessageLimit),
          dailyTokenLimit: Math.max(0, policy.dailyTokenLimit),
          monthlyTokenLimit: Math.max(0, policy.monthlyTokenLimit),
        }
      : null;
    const userLimits: UsageScope | null = telegramUser
      ? {
          dailyMessageLimit: Math.max(0, telegramUser.dailyMessageLimit),
          monthlyMessageLimit: Math.max(0, telegramUser.monthlyMessageLimit),
          dailyTokenLimit: Math.max(0, telegramUser.dailyTokenLimit),
          monthlyTokenLimit: Math.max(0, telegramUser.monthlyTokenLimit),
        }
      : null;

    if (!workspaceLimits && !userLimits) return false;

    const workspaceUsage = await Promise.all([
      tx.usageEvent.aggregate({
        where: { workspaceId, createdAt: { gte: day } },
        _sum: { totalTokens: true },
        _count: { _all: true },
      }),
      tx.usageEvent.aggregate({
        where: { workspaceId, createdAt: { gte: month } },
        _sum: { totalTokens: true },
        _count: { _all: true },
      }),
      tx.usageReservation.aggregate({
        where: { workspaceId, createdAt: { gte: day }, expiresAt: { gt: now } },
        _sum: { tokens: true, messages: true },
      }),
      tx.usageReservation.aggregate({
        where: { workspaceId, createdAt: { gte: month }, expiresAt: { gt: now } },
        _sum: { tokens: true, messages: true },
      }),
    ]);

    const workspaceTotals = {
      dailyMessages:
        workspaceUsage[0]._count._all + (workspaceUsage[2]._sum.messages ?? 0),
      monthlyMessages:
        workspaceUsage[1]._count._all + (workspaceUsage[3]._sum.messages ?? 0),
      dailyTokens:
        (workspaceUsage[0]._sum.totalTokens ?? 0) + (workspaceUsage[2]._sum.tokens ?? 0),
      monthlyTokens:
        (workspaceUsage[1]._sum.totalTokens ?? 0) + (workspaceUsage[3]._sum.tokens ?? 0),
    };

    if (workspaceLimits) {
      assertScopeWithinLimits(
        workspaceLimits,
        workspaceTotals,
        incomingMessages,
        reservationTokens,
        "این فضای کاری",
      );
    }

    if (userLimits && telegramUserId) {
      const userUsage = await Promise.all([
        tx.usageEvent.aggregate({
          where: { telegramUserId, createdAt: { gte: day } },
          _sum: { totalTokens: true },
          _count: { _all: true },
        }),
        tx.usageEvent.aggregate({
          where: { telegramUserId, createdAt: { gte: month } },
          _sum: { totalTokens: true },
          _count: { _all: true },
        }),
        tx.usageReservation.aggregate({
          where: { telegramUserId, createdAt: { gte: day }, expiresAt: { gt: now } },
          _sum: { tokens: true, messages: true },
        }),
        tx.usageReservation.aggregate({
          where: { telegramUserId, createdAt: { gte: month }, expiresAt: { gt: now } },
          _sum: { tokens: true, messages: true },
        }),
      ]);

      assertScopeWithinLimits(
        userLimits,
        {
          dailyMessages: userUsage[0]._count._all + (userUsage[2]._sum.messages ?? 0),
          monthlyMessages: userUsage[1]._count._all + (userUsage[3]._sum.messages ?? 0),
          dailyTokens: (userUsage[0]._sum.totalTokens ?? 0) + (userUsage[2]._sum.tokens ?? 0),
          monthlyTokens: (userUsage[1]._sum.totalTokens ?? 0) + (userUsage[3]._sum.tokens ?? 0),
        },
        incomingMessages,
        reservationTokens,
        "این کاربر تلگرام",
      );
    }

    await tx.usageReservation.create({
      data: {
        id: reservationId,
        workspaceId,
        telegramUserId: telegramUserId ?? null,
        messages: Math.max(0, Math.floor(incomingMessages)),
        tokens: reservationTokens,
        expiresAt,
      },
    });
    return true;
  });

  return reserved ? reservationId : null;
}

export async function releaseUsageReservation(reservationId: string | null | undefined): Promise<void> {
  if (!reservationId) return;
  await db.usageReservation.delete({ where: { id: reservationId } }).catch(() => undefined);
}

/**
 * Backward-compatible check for non-generation callers. Chat paths should use
 * reserveUsageWithinLimits so the quota remains held until the request finishes.
 */
export async function assertUsageWithinLimits(
  workspaceId: string,
  incomingMessages = 1,
  incomingTokens = 0,
  telegramUserId?: string,
) {
  const reservation = await reserveUsageWithinLimits(
    workspaceId,
    incomingMessages,
    incomingTokens,
    0,
    telegramUserId,
  );
  await releaseUsageReservation(reservation);
}

export function tokenEstimateForMessages(messages: Array<{ content: string }>): number {
  return messages.reduce((sum, message) => sum + estimateTokens(message.content), 0);
}
