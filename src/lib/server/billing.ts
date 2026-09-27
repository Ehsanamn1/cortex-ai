import { db } from "@/lib/db";

const CREDIT_USD_MICROS = Number(process.env.CORTEX_CREDIT_USD_MICROS ?? 1000);

export type BillingPlanDto = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  priceMinor: string;
  currency: string;
  includedCredits: string;
  monthlyMessages: number;
  maxAgents: number;
  maxTelegramUsers: number;
  maxStorageMb: number;
  overageEnabled: boolean;
  customPricing: boolean;
  active: boolean;
};

export type WalletDto = {
  id: string;
  currency: string;
  balanceCredits: string;
  reservedCredits: string;
  availableCredits: string;
};

export type BillingSummaryDto = {
  wallet: WalletDto;
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    plan: BillingPlanDto;
  } | null;
  plans: BillingPlanDto[];
  modelCount: number;
};

const DEFAULT_PLANS = [
  {
    key: "free",
    name: "Free",
    description: "برای شروع و تست محدود Cortex.",
    priceMinor: 0n,
    includedCredits: 1000n,
    monthlyMessages: 200,
    maxAgents: 1,
    maxTelegramUsers: 10,
    maxStorageMb: 20,
    overageEnabled: false,
    customPricing: false,
  },
  {
    key: "starter",
    name: "Starter",
    description: "برای کسب‌وکارهای کوچک با مصرف کنترل‌شده.",
    priceMinor: 4_900_000n,
    includedCredits: 5_000n,
    monthlyMessages: 2_000,
    maxAgents: 2,
    maxTelegramUsers: 100,
    maxStorageMb: 500,
    overageEnabled: false,
    customPricing: false,
  },
  {
    key: "business",
    name: "Business",
    description: "برای تیم‌هایی با چند Agent و مصرف بالاتر.",
    priceMinor: 14_900_000n,
    includedCredits: 25_000n,
    monthlyMessages: 10_000,
    maxAgents: 8,
    maxTelegramUsers: 1_000,
    maxStorageMb: 5_000,
    overageEnabled: true,
    customPricing: false,
  },
  {
    key: "pro",
    name: "Pro",
    description: "برای استفاده سنگین، مدل‌های پیشرفته و کنترل بیشتر.",
    priceMinor: 34_900_000n,
    includedCredits: 80_000n,
    monthlyMessages: 50_000,
    maxAgents: 25,
    maxTelegramUsers: 10_000,
    maxStorageMb: 20_000,
    overageEnabled: true,
    customPricing: false,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    description: "قیمت‌گذاری و محدودیت‌های سفارشی.",
    priceMinor: 0n,
    includedCredits: 0n,
    monthlyMessages: 0,
    maxAgents: 0,
    maxTelegramUsers: 0,
    maxStorageMb: 0,
    overageEnabled: true,
    customPricing: true,
  },
] as const;

function planDto(plan: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  priceMinor: bigint;
  currency: string;
  includedCredits: bigint;
  monthlyMessages: number;
  maxAgents: number;
  maxTelegramUsers: number;
  maxStorageMb: number;
  overageEnabled: boolean;
  customPricing: boolean;
  active: boolean;
}): BillingPlanDto {
  return {
    id: plan.id,
    key: plan.key,
    name: plan.name,
    description: plan.description,
    priceMinor: plan.priceMinor.toString(),
    currency: plan.currency,
    includedCredits: plan.includedCredits.toString(),
    monthlyMessages: plan.monthlyMessages,
    maxAgents: plan.maxAgents,
    maxTelegramUsers: plan.maxTelegramUsers,
    maxStorageMb: plan.maxStorageMb,
    overageEnabled: plan.overageEnabled,
    customPricing: plan.customPricing,
    active: plan.active,
  };
}

export async function ensureDefaultPlans(): Promise<void> {
  for (const plan of DEFAULT_PLANS) {
    await db.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        description: plan.description,
        currency: "IRR",
        active: true,
      },
      create: {
        ...plan,
        currency: "IRR",
      },
    });
  }
}

export async function ensureWallet(workspaceId: string) {
  return db.walletAccount.upsert({
    where: { workspaceId },
    update: {},
    create: { workspaceId, currency: "CREDITS" },
  });
}

export async function getWalletDto(workspaceId: string): Promise<WalletDto> {
  const wallet = await ensureWallet(workspaceId);
  const available = wallet.balanceCredits - wallet.reservedCredits;
  return {
    id: wallet.id,
    currency: wallet.currency,
    balanceCredits: wallet.balanceCredits.toString(),
    reservedCredits: wallet.reservedCredits.toString(),
    availableCredits: (available > 0n ? available : 0n).toString(),
  };
}

export async function getBillingSummary(workspaceId: string): Promise<BillingSummaryDto> {
  await ensureDefaultPlans();
  const [wallet, subscription, plans, modelCount] = await Promise.all([
    getWalletDto(workspaceId),
    db.subscription.findFirst({
      where: { workspaceId, status: "ACTIVE" },
      include: { plan: true },
      orderBy: { currentPeriodEnd: "desc" },
    }),
    db.plan.findMany({ where: { active: true }, orderBy: { priceMinor: "asc" } }),
    db.modelCatalog.count({ where: { active: true, commercialEnabled: true } }),
  ]);

  return {
    wallet,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          plan: planDto(subscription.plan),
        }
      : null,
    plans: plans.map(planDto),
    modelCount,
  };
}

export async function grantCredits(input: {
  workspaceId: string;
  amountCredits: bigint | number;
  entryType?: string;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey: string;
  metadata?: unknown;
}): Promise<bigint> {
  const amount = BigInt(input.amountCredits);
  if (amount <= 0n) throw new Error("مقدار اعتبار باید بزرگ‌تر از صفر باشد.");
  const wallet = await ensureWallet(input.workspaceId);

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${wallet.id}))`;

    const duplicate = await tx.creditLedgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { balanceAfter: true },
    });
    if (duplicate) return duplicate.balanceAfter;

    const current = await tx.walletAccount.findUniqueOrThrow({ where: { id: wallet.id } });
    const nextBalance = current.balanceCredits + amount;
    await tx.walletAccount.update({
      where: { id: wallet.id },
      data: { balanceCredits: nextBalance, version: { increment: 1 } },
    });
    await tx.creditLedgerEntry.create({
      data: {
        workspaceId: input.workspaceId,
        walletId: wallet.id,
        entryType: input.entryType ?? "GRANT",
        deltaCredits: amount,
        balanceAfter: nextBalance,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        idempotencyKey: input.idempotencyKey,
        description: input.description ?? null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
    return nextBalance;
  });
}

export async function reserveCredits(input: {
  workspaceId: string;
  amountCredits: bigint | number;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey: string;
  ttlMs?: number;
}): Promise<string> {
  const amount = BigInt(input.amountCredits);
  if (amount <= 0n) throw new Error("مقدار اعتبار برای رزرو باید بزرگ‌تر از صفر باشد.");

  const wallet = await ensureWallet(input.workspaceId);
  const expiresAt = new Date(Date.now() + Math.max(30_000, input.ttlMs ?? 5 * 60_000));

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${wallet.id}))`;

    const duplicate = await tx.creditReservation.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (duplicate && duplicate.status === "PENDING" && duplicate.expiresAt > new Date()) return duplicate.id;
    if (duplicate && duplicate.status !== "PENDING") {
      throw new Error("رزرو اعتبار با این شناسه قبلاً نهایی شده است.");
    }

    const now = new Date();
    const expired = await tx.creditReservation.findMany({
      where: { walletId: wallet.id, status: "PENDING", expiresAt: { lte: now } },
      select: { id: true, amountCredits: true },
    });
    const expiredTotal = expired.reduce((sum, item) => sum + item.amountCredits, 0n);
    if (expired.length) {
      await tx.creditReservation.updateMany({
        where: { id: { in: expired.map((item) => item.id) } },
        data: { status: "EXPIRED", releasedAt: now },
      });
      if (expiredTotal > 0n) {
        await tx.walletAccount.update({
          where: { id: wallet.id },
          data: { reservedCredits: { decrement: expiredTotal }, version: { increment: 1 } },
        });
      }
    }

    const current = await tx.walletAccount.findUniqueOrThrow({ where: { id: wallet.id } });
    const available = current.balanceCredits - current.reservedCredits;
    if (available < amount) {
      const err = new Error("اعتبار کافی برای اجرای این درخواست وجود ندارد.");
      (err as Error & { status?: number }).status = 402;
      throw err;
    }

    const reservation = await tx.creditReservation.create({
      data: {
        workspaceId: input.workspaceId,
        walletId: wallet.id,
        amountCredits: amount,
        status: "PENDING",
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        idempotencyKey: input.idempotencyKey,
        expiresAt,
      },
    });

    await tx.walletAccount.update({
      where: { id: wallet.id },
      data: { reservedCredits: { increment: amount }, version: { increment: 1 } },
    });

    return reservation.id;
  });
}

export async function commitCreditReservation(reservationId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const reservation = await tx.creditReservation.findUnique({ where: { id: reservationId } });
    if (!reservation) return;
    if (reservation.status === "COMMITTED" || reservation.status === "RELEASED" || reservation.status === "EXPIRED") return;

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${reservation.walletId}))`;
    const current = await tx.walletAccount.findUniqueOrThrow({ where: { id: reservation.walletId } });
    if (current.balanceCredits < reservation.amountCredits) {
      throw new Error("موجودی اعتبار قبل از تسویه رزرو کافی نیست.");
    }

    const nextBalance = current.balanceCredits - reservation.amountCredits;
    await tx.walletAccount.update({
      where: { id: reservation.walletId },
      data: {
        balanceCredits: nextBalance,
        reservedCredits: { decrement: reservation.amountCredits },
        version: { increment: 1 },
      },
    });
    await tx.creditLedgerEntry.create({
      data: {
        workspaceId: reservation.workspaceId,
        walletId: reservation.walletId,
        entryType: "USAGE",
        deltaCredits: -reservation.amountCredits,
        balanceAfter: nextBalance,
        referenceType: reservation.referenceType ?? "RESERVATION",
        referenceId: reservation.referenceId ?? reservation.id,
        idempotencyKey: "commit:" + reservation.id,
        description: "مصرف اعتبار برای اجرای Agent",
      },
    });
    await tx.creditReservation.update({
      where: { id: reservation.id },
      data: { status: "COMMITTED", committedAt: new Date() },
    });
  });
}

export async function releaseCreditReservation(reservationId: string | null | undefined): Promise<void> {
  if (!reservationId) return;
  await db.$transaction(async (tx) => {
    const reservation = await tx.creditReservation.findUnique({ where: { id: reservationId } });
    if (!reservation || reservation.status !== "PENDING") return;

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${reservation.walletId}))`;
    await tx.creditReservation.update({
      where: { id: reservation.id },
      data: { status: "RELEASED", releasedAt: new Date() },
    });
    await tx.walletAccount.update({
      where: { id: reservation.walletId },
      data: { reservedCredits: { decrement: reservation.amountCredits }, version: { increment: 1 } },
    });
  }).catch(() => undefined);
}

export function providerCostToCredits(providerCostMicros: number, multiplierMilli = 1000): bigint {
  const safeCost = Math.max(0, Math.floor(Number(providerCostMicros) || 0));
  const safeMultiplier = Math.max(1, Math.floor(Number(multiplierMilli) || 1000));
  const microsPerCredit = Math.max(1, Math.floor(Number.isFinite(CREDIT_USD_MICROS) && CREDIT_USD_MICROS > 0 ? CREDIT_USD_MICROS : 1000));
  const base = Math.ceil(safeCost / microsPerCredit);
  return BigInt(Math.max(1, Math.ceil((base * safeMultiplier) / 1000)));
}
