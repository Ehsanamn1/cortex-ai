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
          overageEnabled: plan.overageEnabled,
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