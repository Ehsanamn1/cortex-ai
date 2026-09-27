import { db } from "@/lib/db";
import { estimateLlmCostMicros, getKnownModelCatalog, getModelRate } from "@/lib/server/pricing";
import { llmManager } from "@/lib/providers/llm/manager";

export const DEFAULT_BILLING_PLANS = [
  { key: "free", name: "رایگان", description: "برای شروع و تست Cortex", priceToman: 0, monthlyCredits: 5000, overageCreditPriceToman: 0, sortOrder: 0 },
  { key: "starter", name: "Starter", description: "برای کسب‌وکارهای کوچک", priceToman: 5900000, monthlyCredits: 10000, overageCreditPriceToman: 700, sortOrder: 1 },
  { key: "business", name: "Business", description: "برای تیم‌ها و حجم بالاتر", priceToman: 16900000, monthlyCredits: 35000, overageCreditPriceToman: 600, sortOrder: 2 },
  { key: "pro", name: "Pro", description: "برای استفاده سنگین و مدل‌های پیشرفته", priceToman: 39900000, monthlyCredits: 100000, overageCreditPriceToman: 500, sortOrder: 3 },
  { key: "enterprise", name: "Enterprise", description: "قرارداد و محدودیت سفارشی", priceToman: 0, monthlyCredits: 0, overageCreditPriceToman: 0, sortOrder: 4 },
] as const;

const CATALOG_CACHE_MS = 10 * 60 * 1000;
let catalogReadyAt = 0;
let catalogPromise: Promise<void> | null = null;

function periodEndFor(start: Date): Date {
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return end;
}

export function defaultCreditMultiplierBps(qualityTier: string): number {
  switch (qualityTier) {
    case "economy": return 100;
    case "premium": return 400;
    case "deep": return 800;
    default: return 200;
  }
}

export function creditsFromProviderCost(providerCostMicros: number, multiplierBps: number): number {
  if (!Number.isFinite(providerCostMicros) || providerCostMicros <= 0) return 0;
  return Math.max(1, Math.ceil((providerCostMicros / 1000) * (multiplierBps / 100)));
}

function envEnforcementDefault(): boolean {
  return process.env.CORTEX_BILLING_ENFORCE?.trim().toLowerCase() === "true";
}

export class BillingInsufficientCreditsError extends Error {
  status = 402;
  code = "insufficient_credits";
  constructor() {
    super("اعتبار Cortex شما برای این درخواست کافی نیست. برای ادامه، اعتبار بیشتری تهیه کنید.");
    this.name = "BillingInsufficientCreditsError";
  }
}

export class BillingModelUnavailableError extends Error {
  status = 403;
  code = "model_not_in_plan";
  constructor(model: string) {
    super("مدل «" + model + "» در پلن فعلی شما فعال نیست.");
    this.name = "BillingModelUnavailableError";
  }
}

async function ensurePlanCatalog() {
  if (catalogPromise && Date.now() - catalogReadyAt < CATALOG_CACHE_MS) return catalogPromise;
  catalogPromise = (async () => {
    for (const plan of DEFAULT_BILLING_PLANS) {
      await db.plan.upsert({
        where: { key: plan.key },
        update: {
          name: plan.name,
          description: plan.description,
          priceToman: plan.priceToman,
          monthlyCredits: plan.monthlyCredits,
          overageCreditPriceToman: plan.overageCreditPriceToman,
          sortOrder: plan.sortOrder,
          active: true,
        },
        create: {
          key: plan.key,
          name: plan.name,
          description: plan.description,
          priceToman: plan.priceToman,
          currency: "TOMAN",
          monthlyCredits: plan.monthlyCredits,
          overageCreditPriceToman: plan.overageCreditPriceToman,
          sortOrder: plan.sortOrder,
          active: true,
        },
      });
    }
  })().then(() => { catalogReadyAt = Date.now(); }).finally(() => { catalogPromise = null; });
  return catalogPromise;
}

async function ensureModel(provider: string, model: string) {
  const known = getKnownModelCatalog().find(
    (entry) => entry.provider.toLowerCase() === provider.toLowerCase() && entry.modelId.toLowerCase() === model.toLowerCase(),
  );
  const rate = getModelRate(provider, model);
  const qualityTier = known?.qualityTier ?? "balanced";
  const multiplierBps = defaultCreditMultiplierBps(qualityTier);
  const catalog = await db.modelCatalog.upsert({
    where: { provider_modelId: { provider, modelId: model } },
    update: {
      displayName: known?.displayName ?? model,
      inputUsdPer1M: rate.inputUsdPer1M,
      outputUsdPer1M: rate.outputUsdPer1M,
      contextWindow: known?.contextWindow ?? null,
      vision: known?.vision ?? false,
      tools: known?.tools ?? false,
      structuredOutput: known?.structuredOutput ?? false,
      reasoning: known?.reasoning ?? false,
      qualityTier,
      speedTier: known?.speedTier ?? "balanced",
      commercialAvailable: rate.known,
      active: true,
    },
    create: {
      provider,
      modelId: model,
      displayName: known?.displayName ?? model,
      inputUsdPer1M: rate.inputUsdPer1M,
      outputUsdPer1M: rate.outputUsdPer1M,
      contextWindow: known?.contextWindow ?? null,
      vision: known?.vision ?? false,
      tools: known?.tools ?? false,
      structuredOutput: known?.structuredOutput ?? false,
      reasoning: known?.reasoning ?? false,
      qualityTier,
      speedTier: known?.speedTier ?? "balanced",
      commercialAvailable: rate.known,
      active: true,
    },
  });
  return { catalog, defaultMultiplierBps: multiplierBps };
}

async function ensureWorkspaceBilling(workspaceId: string) {
  await ensurePlanCatalog();
  const freePlan = await db.plan.findUniqueOrThrow({ where: { key: "free" } });
  const now = new Date();

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}))`;

    let account = await tx.workspaceBillingAccount.findUnique({ where: { workspaceId }, include: { plan: true } });

    if (!account) {
      const created = await tx.workspaceBillingAccount.create({
        data: {
          workspaceId,
          planId: freePlan.id,
          balanceCredits: 0,
          status: "active",
          enforcementEnabled: envEnforcementDefault(),
          periodStart: now,
          periodEnd: periodEndFor(now),
        },
        include: { plan: true },
      });
      account = created;
      await tx.subscription.create({
        data: {
          workspaceId,
          billingAccountId: account.id,
          planId: freePlan.id,
          status: "active",
          provider: "manual",
          periodStart: account.periodStart,
          periodEnd: account.periodEnd,
        },
      });
    }

    if (account.periodEnd <= now) {
      if (account.plan.priceToman === 0 && account.plan.monthlyCredits > 0) {
        const nextStart = account.periodEnd;
        const nextEnd = periodEndFor(nextStart);
        const idempotencyKey = "monthly-grant:" + account.id + ":" + nextStart.toISOString();
        const existingGrant = await tx.creditLedgerEntry.findUnique({ where: { idempotencyKey } });
        const balanceBefore = account.balanceCredits;
        const nextBalance = existingGrant ? account.balanceCredits : balanceBefore + account.plan.monthlyCredits;
        if (!existingGrant) {
          await tx.creditLedgerEntry.create({
            data: {
              workspaceId,
              billingAccountId: account.id,
              amountCredits: account.plan.monthlyCredits,
              balanceAfter: nextBalance,
              entryType: "monthly_grant",
              referenceType: "subscription",
              description: "اعتبار ماهانه پلن " + account.plan.name,
              idempotencyKey,
            },
          });
        }
        await tx.workspaceBillingAccount.update({
          where: { id: account.id },
          data: { balanceCredits: nextBalance, periodStart: nextStart, periodEnd: nextEnd, status: "active" },
        });
        await tx.subscription.updateMany({
          where: { billingAccountId: account.id, status: "active" },
          data: { periodStart: nextStart, periodEnd: nextEnd },
        });
        account = await tx.workspaceBillingAccount.findUniqueOrThrow({ where: { id: account.id }, include: { plan: true } });
      } else if (account.plan.priceToman > 0) {
        await tx.workspaceBillingAccount.update({ where: { id: account.id }, data: { status: "past_due" } });
        account = await tx.workspaceBillingAccount.findUniqueOrThrow({ where: { id: account.id }, include: { plan: true } });
      }
    }

    const initialGrantKey = "initial-grant:" + account.id;
    const initialGrant = await tx.creditLedgerEntry.findUnique({ where: { idempotencyKey: initialGrantKey } });
    if (!initialGrant && account.plan.monthlyCredits > 0 && account.balanceCredits === 0) {
      const nextBalance = account.plan.monthlyCredits;
      await tx.creditLedgerEntry.create({
        data: {
          workspaceId,
          billingAccountId: account.id,
          amountCredits: account.plan.monthlyCredits,
          balanceAfter: nextBalance,
          entryType: "initial_grant",
          referenceType: "subscription",
          description: "اعتبار شروع پلن " + account.plan.name,
          idempotencyKey: initialGrantKey,
        },
      });
      await tx.workspaceBillingAccount.update({ where: { id: account.id }, data: { balanceCredits: nextBalance } });
      account = await tx.workspaceBillingAccount.findUniqueOrThrow({ where: { id: account.id }, include: { plan: true } });
    }

    return account;
  });
}

export async function getBillingSnapshot(workspaceId: string) {
  const account = await ensureWorkspaceBilling(workspaceId);
  const [subscription, recentLedger, usage] = await Promise.all([
    db.subscription.findFirst({ where: { billingAccountId: account.id, status: "active" }, orderBy: { createdAt: "desc" }, include: { plan: true } }),
    db.creditLedgerEntry.findMany({ where: { billingAccountId: account.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    db.usageEvent.aggregate({ where: { workspaceId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, _sum: { totalTokens: true, estimatedCostMicros: true }, _count: { _all: true } }),
  ]);

  const catalog = await db.modelCatalog.findMany({
    where: { active: true },
    orderBy: [{ provider: "asc" }, { displayName: "asc" }],
    take: 100,
  });
  const access = await db.planModelAccess.findMany({ where: { planId: account.planId, enabled: true } });
  const accessMap = new Map(access.map((item) => [item.modelCatalogId, item]));

  return {
    account: {
      id: account.id,
      plan: account.plan,
      balanceCredits: account.balanceCredits,
      status: account.status,
      enforcementEnabled: account.enforcementEnabled,
      periodStart: account.periodStart.toISOString(),
      periodEnd: account.periodEnd.toISOString(),
    },
    subscription: subscription ? {
      id: subscription.id,
      status: subscription.status,
      periodStart: subscription.periodStart.toISOString(),
      periodEnd: subscription.periodEnd.toISOString(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    } : null,
    usage30Days: {
      events: usage._count._all,
      tokens: usage._sum.totalTokens ?? 0,
      estimatedCostMicros: usage._sum.estimatedCostMicros ?? 0,
    },
    models: catalog.map((item) => ({
      id: item.id,
      provider: item.provider,
      modelId: item.modelId,
      displayName: item.displayName,
      inputUsdPer1M: item.inputUsdPer1M,
      outputUsdPer1M: item.outputUsdPer1M,
      qualityTier: item.qualityTier,
      speedTier: item.speedTier,
      commercialAvailable: item.commercialAvailable,
      enabledForPlan: accessMap.get(item.id)?.enabled ?? item.commercialAvailable,
      creditMultiplierBps: accessMap.get(item.id)?.creditMultiplierBps ?? defaultCreditMultiplierBps(item.qualityTier),
    })),
    ledger: recentLedger.map((entry) => ({
      id: entry.id,
      amountCredits: entry.amountCredits,
      balanceAfter: entry.balanceAfter,
      entryType: entry.entryType,
      description: entry.description,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

export interface BillingReservationResult {
  reservationId: string | null;
  estimatedCredits: number;
  providerCostMicros: number;
  creditMultiplierBps: number;
  enforcementEnabled: boolean;
}

export async function reserveBillingForAgentRequest(params: {
  workspaceId: string;
  agentId: string;
  inputTokens: number;
  maxOutputTokens: number;
}): Promise<BillingReservationResult> {
  const resolved = await llmManager.resolveForAgent(params.agentId, params.workspaceId);
  const provider = resolved.status.provider;
  const model = resolved.status.model;
  if (!resolved.provider || !provider || provider === "none" || !model) {
    return {
      reservationId: null,
      estimatedCredits: 0,
      providerCostMicros: 0,
      creditMultiplierBps: 100,
      enforcementEnabled: false,
    };
  }
  return reserveBillingCredits({
    workspaceId: params.workspaceId,
    provider,
    model,
    inputTokens: params.inputTokens,
    maxOutputTokens: params.maxOutputTokens,
  });
}

export async function reserveBillingCredits(params: {
  workspaceId: string;
  provider: string;
  model: string;
  inputTokens: number;
  maxOutputTokens: number;
}): Promise<BillingReservationResult> {
  const account = await ensureWorkspaceBilling(params.workspaceId);
  const { catalog, defaultMultiplierBps: fallbackMultiplier } = await ensureModel(params.provider, params.model);
  const access = await db.planModelAccess.upsert({
    where: { planId_modelCatalogId: { planId: account.planId, modelCatalogId: catalog.id } },
    update: {},
    create: { planId: account.planId, modelCatalogId: catalog.id, enabled: true, creditMultiplierBps: fallbackMultiplier },
  });

  if (account.enforcementEnabled && account.plan.priceToman > 0 && access.enabled === false) {
    throw new BillingModelUnavailableError(params.model);
  }

  const providerCostMicros = estimateLlmCostMicros(
    Math.max(0, Math.floor(params.inputTokens)),
    Math.max(0, Math.floor(params.maxOutputTokens)),
    params.provider,
    params.model,
  );
  const multiplierBps = Math.max(1, access.creditMultiplierBps || fallbackMultiplier);
  const estimatedCredits = creditsFromProviderCost(providerCostMicros, multiplierBps);

  if (!account.enforcementEnabled || estimatedCredits <= 0) {
    return { reservationId: null, estimatedCredits, providerCostMicros, creditMultiplierBps: multiplierBps, enforcementEnabled: false };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60_000);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${params.workspaceId}))`;
    await tx.creditReservation.deleteMany({ where: { workspaceId: params.workspaceId, status: "active", expiresAt: { lte: now } } });
    const fresh = await tx.workspaceBillingAccount.findUniqueOrThrow({ where: { workspaceId: params.workspaceId } });
    const pending = await tx.creditReservation.aggregate({
      where: { billingAccountId: fresh.id, status: "active", expiresAt: { gt: now } },
      _sum: { reservedCredits: true },
    });
    const available = fresh.balanceCredits - (pending._sum.reservedCredits ?? 0);
    if (available < estimatedCredits) throw new BillingInsufficientCreditsError();

    const reservation = await tx.creditReservation.create({
      data: {
        workspaceId: params.workspaceId,
        billingAccountId: fresh.id,
        provider: params.provider,
        model: params.model,
        reservedCredits: estimatedCredits,
        status: "active",
        expiresAt,
      },
    });
    return { reservationId: reservation.id, estimatedCredits, providerCostMicros, creditMultiplierBps: multiplierBps, enforcementEnabled: true };
  });
}

export async function releaseBillingReservation(reservationId: string | null | undefined): Promise<void> {
  if (!reservationId) return;
  await db.creditReservation.updateMany({ where: { id: reservationId, status: "active" }, data: { status: "released" } }).catch(() => undefined);
}

export async function recordUsageAndCharge(params: {
  usage: {
    workspaceId: string;
    agentId?: string | null;
    userId?: string | null;
    telegramBotId?: string | null;
    telegramUserId?: string | null;
    channel: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens?: number;
  };
  reservationId?: string | null;
}) {
  const account = await ensureWorkspaceBilling(params.usage.workspaceId);
  const providerCostMicros = estimateLlmCostMicros(
    Math.max(0, Math.floor(params.usage.inputTokens)),
    Math.max(0, Math.floor(params.usage.outputTokens)),
    params.usage.provider,
    params.usage.model,
  );
  const { catalog, defaultMultiplierBps } = await ensureModel(params.usage.provider, params.usage.model);
  const access = await db.planModelAccess.upsert({
    where: { planId_modelCatalogId: { planId: account.planId, modelCatalogId: catalog.id } },
    update: {},
    create: { planId: account.planId, modelCatalogId: catalog.id, enabled: true, creditMultiplierBps: defaultMultiplierBps },
  });
  const multiplierBps = Math.max(1, access.creditMultiplierBps || defaultMultiplierBps);
  const chargedCredits = creditsFromProviderCost(providerCostMicros, multiplierBps);
  const totalTokens = params.usage.totalTokens ?? params.usage.inputTokens + params.usage.outputTokens;

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${params.usage.workspaceId}))`;
    const usageEvent = await tx.usageEvent.create({
      data: {
        workspaceId: params.usage.workspaceId,
        agentId: params.usage.agentId ?? null,
        userId: params.usage.userId ?? null,
        telegramBotId: params.usage.telegramBotId ?? null,
        telegramUserId: params.usage.telegramUserId ?? null,
        channel: params.usage.channel,
        provider: params.usage.provider,
        model: params.usage.model,
        inputTokens: params.usage.inputTokens,
        outputTokens: params.usage.outputTokens,
        totalTokens,
        estimatedCostMicros: providerCostMicros,
      },
    });

    const fresh = await tx.workspaceBillingAccount.findUniqueOrThrow({ where: { id: account.id } });

    if (!fresh.enforcementEnabled || chargedCredits <= 0) {
      await tx.billingCharge.create({
        data: {
          workspaceId: params.usage.workspaceId,
          billingAccountId: fresh.id,
          usageEventId: usageEvent.id,
          provider: params.usage.provider,
          model: params.usage.model,
          providerCostMicros,
          creditMultiplierBps: multiplierBps,
          chargedCredits,
          status: "shadow",
          idempotencyKey: "usage:" + usageEvent.id,
        },
      });
      if (params.reservationId) await tx.creditReservation.updateMany({ where: { id: params.reservationId, status: "active" }, data: { status: "captured" } });
      return { usageEvent, chargedCredits, balanceCredits: fresh.balanceCredits, status: "shadow" };
    }

    const pending = await tx.creditReservation.aggregate({
      where: {
        billingAccountId: fresh.id,
        status: "active",
        expiresAt: { gt: new Date() },
        NOT: params.reservationId ? { id: params.reservationId } : undefined,
      },
      _sum: { reservedCredits: true },
    });
    const available = fresh.balanceCredits - (pending._sum.reservedCredits ?? 0);
    if (available < chargedCredits) {
      const nextBalance = fresh.balanceCredits - chargedCredits;
      await tx.workspaceBillingAccount.update({ where: { id: fresh.id }, data: { balanceCredits: nextBalance } });
      await tx.creditLedgerEntry.create({
        data: {
          workspaceId: params.usage.workspaceId,
          billingAccountId: fresh.id,
          amountCredits: -chargedCredits,
          balanceAfter: nextBalance,
          entryType: "usage_debt",
          referenceType: "usage_event",
          referenceId: usageEvent.id,
          description: "مصرف بیشتر از اعتبار رزرو‌شده",
          idempotencyKey: "charge-debt:" + usageEvent.id,
        },
      });
      await tx.billingCharge.create({
        data: {
          workspaceId: params.usage.workspaceId,
          billingAccountId: fresh.id,
          usageEventId: usageEvent.id,
          provider: params.usage.provider,
          model: params.usage.model,
          providerCostMicros,
          creditMultiplierBps: multiplierBps,
          chargedCredits,
          status: "captured_debt",
          idempotencyKey: "usage:" + usageEvent.id,
        },
      });
      if (params.reservationId) await tx.creditReservation.updateMany({ where: { id: params.reservationId, status: "active" }, data: { status: "captured" } });
      return { usageEvent, chargedCredits, balanceCredits: nextBalance, status: "captured_debt" };
    }

    const nextBalance = fresh.balanceCredits - chargedCredits;
    await tx.workspaceBillingAccount.update({ where: { id: fresh.id }, data: { balanceCredits: nextBalance } });
    await tx.creditLedgerEntry.create({
      data: {
        workspaceId: params.usage.workspaceId,
        billingAccountId: fresh.id,
        amountCredits: -chargedCredits,
        balanceAfter: nextBalance,
        entryType: "usage",
        referenceType: "usage_event",
        referenceId: usageEvent.id,
        description: "مصرف AI · " + params.usage.provider + " · " + params.usage.model,
        idempotencyKey: "charge:" + usageEvent.id,
      },
    });
    await tx.billingCharge.create({
      data: {
        workspaceId: params.usage.workspaceId,
        billingAccountId: fresh.id,
        usageEventId: usageEvent.id,
        provider: params.usage.provider,
        model: params.usage.model,
        providerCostMicros,
        creditMultiplierBps: multiplierBps,
        chargedCredits,
        status: "captured",
        idempotencyKey: "usage:" + usageEvent.id,
      },
    });
    if (params.reservationId) {
      await tx.creditReservation.updateMany({ where: { id: params.reservationId, status: "active" }, data: { status: "captured" } });
    }
    return { usageEvent, chargedCredits, balanceCredits: nextBalance, status: "captured" };
  });
}
