import { db } from "@/lib/db";
import { llmManager } from "@/lib/providers/llm/manager";
import { getKnownModelCatalog, getModelRate, PRICING_VERIFIED_AT, PRICING_MODE } from "@/lib/server/pricing";

export const DEFAULT_BILLING_PLANS = [
  { key: "free", name: "رایگان", description: "برای شروع و تست Cortex", priceToman: 0, monthlyCredits: 5000, overageCreditPriceToman: 0, sortOrder: 0 },
  { key: "starter", name: "Launch", description: "برای شروع واقعی با مدل‌های سریع و اقتصادی", priceToman: 1790000, monthlyCredits: 10000, overageCreditPriceToman: 220, sortOrder: 1 },
  { key: "business", name: "Growth", description: "برای تیم‌ها، Agentها و مصرف حرفه‌ای", priceToman: 8900000, monthlyCredits: 50000, overageCreditPriceToman: 190, sortOrder: 2 },
  { key: "pro", name: "Scale", description: "برای اتوماسیون سنگین و مدل‌های سطح بالا", priceToman: 17900000, monthlyCredits: 100000, overageCreditPriceToman: 175, sortOrder: 3 },
  { key: "enterprise", name: "Enterprise", description: "قرارداد و محدودیت سفارشی", priceToman: 0, monthlyCredits: 0, overageCreditPriceToman: 0, sortOrder: 4 },
] as const;

const CATALOG_CACHE_MS = 10 * 60 * 1000;
let catalogReadyAt = 0;
let catalogPromise: Promise<void> | null = null;
let modelCatalogReadyAt = 0;
let modelCatalogPromise: Promise<void> | null = null;

function periodEndFor(start: Date): Date {
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return end;
}

export const CREDIT_TOP_UP_PACKAGES = {
  starter: { credits: 10_000, amountToman: 1_990_000, label: "۱۰ هزار اعتبار" },
  growth: { credits: 50_000, amountToman: 9_490_000, label: "۵۰ هزار اعتبار" },
  scale: { credits: 100_000, amountToman: 19_490_000, label: "۱۰۰ هزار اعتبار" },
} as const;
export type CreditTopUpPackageKey = keyof typeof CREDIT_TOP_UP_PACKAGES;

export function defaultCreditMultiplierBps(qualityTier: string): number {
  switch (qualityTier) {
    case "economy": return 200;
    case "premium": return 400;
    case "deep": return 800;
    default: return 200;
  }
}

export function creditsFromProviderCost(providerCostMicros: number, multiplierBps: number): number {
  if (!Number.isFinite(providerCostMicros) || providerCostMicros <= 0) return 0;
  return Math.max(1, Math.ceil((providerCostMicros / 1000) * (multiplierBps / 100)));
}

export function catalogCostMicros(
  inputTokens: number,
  outputTokens: number,
  inputUsdPer1M: number,
  outputUsdPer1M: number,
): number {
  const input = Math.max(0, Math.floor(inputTokens));
  const output = Math.max(0, Math.floor(outputTokens));
  const inputRate = Number.isFinite(inputUsdPer1M) && inputUsdPer1M > 0 ? inputUsdPer1M : 0;
  const outputRate = Number.isFinite(outputUsdPer1M) && outputUsdPer1M > 0 ? outputUsdPer1M : 0;
  return Math.max(0, Math.ceil(input * inputRate + output * outputRate));
}


function envEnforcementDefault(): boolean {
  const configured = process.env.CORTEX_BILLING_ENFORCE?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
}

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || process.env.APP_ENV === "test";
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

export class BillingOverageDisabledError extends Error {
  status = 402;
  code = "overage_disabled";
  constructor() {
    super("اعتبار کافی نیست و پلن فعلی اجازه مصرف مازاد را نمی‌دهد.");
    this.name = "BillingOverageDisabledError";
  }
}

async function ensurePlanCatalog() {
  if (catalogReadyAt && Date.now() - catalogReadyAt < CATALOG_CACHE_MS) return;
  if (catalogPromise) return catalogPromise;
  catalogPromise = (async () => {
    for (const plan of DEFAULT_BILLING_PLANS) {
      await db.plan.upsert({
        where: { key: plan.key },
        update: {},
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

async function ensureKnownModelCatalog() {
  if (modelCatalogReadyAt && Date.now() - modelCatalogReadyAt < CATALOG_CACHE_MS) return;
  if (modelCatalogPromise) return modelCatalogPromise;
  modelCatalogPromise = (async () => {
    const known = getKnownModelCatalog();
    const qualityRank: Record<string, number> = { economy: 1, balanced: 2, premium: 3, deep: 4 };
    const plans = await db.plan.findMany({ where: { active: true }, select: { id: true, key: true } });
    for (const entry of known) {
      const { catalog, defaultMultiplierBps: fallbackMultiplier } = await ensureModel(entry.provider, entry.modelId);
      for (const plan of plans) {
        const maxRank = plan.key === "free" || plan.key === "starter" ? 2 : plan.key === "business" ? 3 : 4;
        const enabled = qualityRank[entry.qualityTier] <= maxRank && Boolean(entry.commercialAvailable ?? true);
        const multiplierBps = Math.max(1, fallbackMultiplier);
        await db.planModelAccess.upsert({
          where: { planId_modelCatalogId: { planId: plan.id, modelCatalogId: catalog.id } },
          update: { enabled, creditMultiplierBps: multiplierBps },
          create: { planId: plan.id, modelCatalogId: catalog.id, enabled, creditMultiplierBps: multiplierBps },
        });
      }
    }
  })().then(() => { modelCatalogReadyAt = Date.now(); }).finally(() => { modelCatalogPromise = null; });
  return modelCatalogPromise;
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
    update: {},
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

    if (envEnforcementDefault() && !account.enforcementEnabled) {
      await tx.workspaceBillingAccount.update({ where: { id: account.id }, data: { enforcementEnabled: true } });
      account = await tx.workspaceBillingAccount.findUniqueOrThrow({ where: { id: account.id }, include: { plan: true } });
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
  await ensureKnownModelCatalog();
  const usageSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [subscription, recentLedger, usage, usageByModel, plans, billedUsage, billedByModel, topUpRequests, recentInvoices] = await Promise.all([
    db.subscription.findFirst({ where: { billingAccountId: account.id, status: "active" }, orderBy: { createdAt: "desc" }, include: { plan: true } }),
    db.creditLedgerEntry.findMany({ where: { billingAccountId: account.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    db.usageEvent.aggregate({ where: { workspaceId, createdAt: { gte: usageSince } }, _sum: { totalTokens: true, inputTokens: true, outputTokens: true, estimatedCostMicros: true }, _count: { _all: true } }),
    db.usageEvent.groupBy({
      by: ["provider", "model"],
      where: { workspaceId, createdAt: { gte: usageSince } },
      _sum: { totalTokens: true, inputTokens: true, outputTokens: true, estimatedCostMicros: true },
      _count: { _all: true },
    }),
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.billingCharge.aggregate({
      where: {
        workspaceId,
        createdAt: { gte: usageSince },
        status: { in: ["captured", "captured_debt"] },
      },
      _sum: { chargedCredits: true },
    }),
    db.billingCharge.groupBy({
      by: ["provider", "model"],
      where: { workspaceId, createdAt: { gte: usageSince }, status: { in: ["captured", "captured_debt"] } },
      _sum: { chargedCredits: true },
    }),
    db.creditTopUpRequest.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id:true, packageKey:true, credits:true, amountToman:true, status:true, note:true, paymentProvider:true, paymentStatus:true, paymentRefId:true, paidAt:true, createdAt:true, reviewedAt:true },
    }),
    db.invoice.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id:true, invoiceNumber:true, status:true, currency:true, subtotalToman:true, overageToman:true, totalToman:true, periodStart:true, periodEnd:true, issuedAt:true, dueAt:true, paidAt:true, createdAt:true },
    }),
  ]);

  const catalog = await db.modelCatalog.findMany({
    where: { active: true },
    orderBy: [{ provider: "asc" }, { displayName: "asc" }],
    take: 100,
  });
  const access = await db.planModelAccess.findMany({ where: { planId: account.planId, enabled: true } });
  const accessMap = new Map(access.map((item) => [item.modelCatalogId, item]));

  return {
    pricing: { verifiedAt: PRICING_VERIFIED_AT, mode: PRICING_MODE },
    account: {
      id: account.id,
      plan: account.plan,
      balanceCredits: account.balanceCredits,
      status: account.status,
      enforcementEnabled: account.enforcementEnabled,
      periodStart: account.periodStart.toISOString(),
      periodEnd: account.periodEnd.toISOString(),
    },
    pricingVerifiedAt: PRICING_VERIFIED_AT,
    topUpPackages: Object.entries(CREDIT_TOP_UP_PACKAGES).map(([key,item]) => ({ key, ...item })),
    plans: plans.map((plan) => ({
      id: plan.id,
      key: plan.key,
      name: plan.name,
      description: plan.description,
      priceToman: plan.priceToman,
      currency: plan.currency,
      monthlyCredits: plan.monthlyCredits,
      overageCreditPriceToman: plan.overageCreditPriceToman,
    })),
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
      credits: billedUsage._sum.chargedCredits ?? 0,
      byModel: (() => {
        const billedMap = new Map(billedByModel.map((row) => [
          (row.provider ?? "unknown") + "::" + (row.model ?? "unknown"),
          row._sum.chargedCredits ?? 0,
        ]));
        const labelFor = (provider: string | null, model: string | null) => {
          const hit = catalog.find((item) => item.provider === provider && item.modelId === model);
          return hit?.displayName ?? model ?? "مدل نامشخص";
        };
        return usageByModel
          .map((row) => {
            const key = (row.provider ?? "unknown") + "::" + (row.model ?? "unknown");
            return {
              provider: row.provider,
              model: row.model,
              displayName: labelFor(row.provider, row.model),
              events: row._count._all,
              inputTokens: row._sum.inputTokens ?? 0,
              outputTokens: row._sum.outputTokens ?? 0,
              tokens: row._sum.totalTokens ?? 0,
              estimatedCostMicros: row._sum.estimatedCostMicros ?? 0,
              credits: billedMap.get(key) ?? 0,
            };
          })
          .sort((a, b) => b.tokens - a.tokens)
          .slice(0, 12);
      })(),
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
      contextWindow: item.contextWindow,
      vision: item.vision,
      tools: item.tools,
      structuredOutput: item.structuredOutput,
      reasoning: item.reasoning,
      commercialAvailable: item.commercialAvailable,
      enabledForPlan: accessMap.get(item.id)?.enabled ?? (account.plan.priceToman === 0 ? item.commercialAvailable : false),
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
    topUpRequests: topUpRequests.map((item) => ({
      id:item.id,
      packageKey:item.packageKey,
      credits:item.credits,
      amountToman:item.amountToman,
      status:item.status,
      note:item.note,
      paymentProvider:item.paymentProvider,
      paymentStatus:item.paymentStatus,
      paymentRefId:item.paymentRefId,
      paidAt:item.paidAt?.toISOString() ?? null,
      createdAt:item.createdAt.toISOString(),
      reviewedAt:item.reviewedAt?.toISOString() ?? null,
    })),
    invoices: recentInvoices.map((item) => ({
      id:item.id,
      invoiceNumber:item.invoiceNumber,
      status:item.status,
      currency:item.currency,
      subtotalToman:item.subtotalToman,
      overageToman:item.overageToman,
      totalToman:item.totalToman,
      periodStart:item.periodStart.toISOString(),
      periodEnd:item.periodEnd.toISOString(),
      issuedAt:item.issuedAt?.toISOString() ?? null,
      dueAt:item.dueAt?.toISOString() ?? null,
      paidAt:item.paidAt?.toISOString() ?? null,
      createdAt:item.createdAt.toISOString(),
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
  if (isTestRuntime()) {
    return {
      reservationId: null,
      estimatedCredits: 0,
      providerCostMicros: 0,
      creditMultiplierBps: 100,
      enforcementEnabled: false,
    };
  }

  const account = await ensureWorkspaceBilling(params.workspaceId);
  if (!account.enforcementEnabled) {
    return {
      reservationId: null,
      estimatedCredits: 0,
      providerCostMicros: 0,
      creditMultiplierBps: 100,
      enforcementEnabled: false,
    };
  }

  const resolved = await llmManager.resolveForAgent(params.agentId, params.workspaceId);
  const provider = resolved.status.provider;
  const model = resolved.status.model;
  if (!resolved.provider || !provider || provider === "none" || !model) {
    return {
      reservationId: null,
      estimatedCredits: 0,
      providerCostMicros: 0,
      creditMultiplierBps: 100,
      enforcementEnabled: true,
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
  const existingAccess = await db.planModelAccess.findUnique({
    where: { planId_modelCatalogId: { planId: account.planId, modelCatalogId: catalog.id } },
  });

  if (account.enforcementEnabled && account.plan.priceToman > 0 && !existingAccess?.enabled) {
    throw new BillingModelUnavailableError(params.model);
  }

  const access = existingAccess ?? {
    enabled: true,
    creditMultiplierBps: fallbackMultiplier,
  };

  const inputTokens = Math.max(0, Math.floor(params.inputTokens));
  const maxOutputTokens = Math.max(0, Math.floor(params.maxOutputTokens));
  const providerCostMicros = catalogCostMicros(inputTokens, maxOutputTokens, catalog.inputUsdPer1M, catalog.outputUsdPer1M);
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
    provider?: string | null;
    model?: string | null;
    inputTokens: number;
    outputTokens: number;
    totalTokens?: number;
    estimatedCostMicros?: number;
  };
  reservationId?: string | null;
}) {
  if (isTestRuntime()) {
    const usageEvent = await db.usageEvent.create({
      data: {
        workspaceId: params.usage.workspaceId,
        agentId: params.usage.agentId ?? null,
        userId: params.usage.userId ?? null,
        telegramBotId: params.usage.telegramBotId ?? null,
        telegramUserId: params.usage.telegramUserId ?? null,
        channel: params.usage.channel ?? "web",
        provider: params.usage.provider ?? null,
        model: params.usage.model ?? null,
        inputTokens: params.usage.inputTokens ?? 0,
        outputTokens: params.usage.outputTokens ?? 0,
        totalTokens: params.usage.totalTokens ?? 0,
        estimatedCostMicros: params.usage.estimatedCostMicros ?? 0,
      },
    });
    return {
      usageEvent,
      chargedCredits: 0,
      balanceCredits: 0,
      status: "test_shadow",
    };
  }

  if (!params.usage.provider || !params.usage.model) {
    const usageEvent = await db.usageEvent.create({
      data: {
        workspaceId: params.usage.workspaceId,
        agentId: params.usage.agentId ?? null,
        userId: params.usage.userId ?? null,
        telegramBotId: params.usage.telegramBotId ?? null,
        telegramUserId: params.usage.telegramUserId ?? null,
        channel: params.usage.channel,
        provider: params.usage.provider ?? null,
        model: params.usage.model ?? null,
        inputTokens: params.usage.inputTokens,
        outputTokens: params.usage.outputTokens,
        totalTokens: params.usage.totalTokens ?? params.usage.inputTokens + params.usage.outputTokens,
        estimatedCostMicros: 0,
      },
    });
    if (params.reservationId) {
      await db.creditReservation.updateMany({
        where: { id: params.reservationId, status: "active" },
        data: { status: "released" },
      });
    }
    return { usageEvent, chargedCredits: 0, balanceCredits: 0, status: "unpriced" as const };
  }
  const provider = params.usage.provider;
  const model = params.usage.model;

  const account = await ensureWorkspaceBilling(params.usage.workspaceId);
  const { catalog, defaultMultiplierBps } = await ensureModel(params.usage.provider, params.usage.model);
  const inputTokens = Math.max(0, Math.floor(params.usage.inputTokens));
  const outputTokens = Math.max(0, Math.floor(params.usage.outputTokens));
  const providerCostMicros = catalogCostMicros(inputTokens, outputTokens, catalog.inputUsdPer1M, catalog.outputUsdPer1M);
  const access = await db.planModelAccess.findUnique({
    where: { planId_modelCatalogId: { planId: account.planId, modelCatalogId: catalog.id } },
  });
  const multiplierBps = Math.max(1, access?.creditMultiplierBps || defaultMultiplierBps);
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
        provider,
        model,
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
          provider,
          model,
          providerCostMicros,
          creditMultiplierBps: multiplierBps,
          chargedCredits,
          status: "shadow",
          idempotencyKey: "usage:" + usageEvent.id,
        },
      });
      if (params.reservationId) await tx.creditReservation.updateMany({ where: { id: params.reservationId, billingAccountId: fresh.id, status: "active" }, data: { status: "captured" } });
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
    if (available < chargedCredits && !account.plan.overageEnabled) {
      throw new BillingOverageDisabledError();
    }

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
          provider,
          model,
          providerCostMicros,
          creditMultiplierBps: multiplierBps,
          chargedCredits,
          status: "captured_debt",
          idempotencyKey: "usage:" + usageEvent.id,
        },
      });
      if (params.reservationId) await tx.creditReservation.updateMany({ where: { id: params.reservationId, billingAccountId: fresh.id, status: "active" }, data: { status: "captured" } });
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
        provider,
        model,
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
