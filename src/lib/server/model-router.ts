import { OpenRouterProvider } from "@/lib/providers/llm/openrouter";
import { db } from "@/lib/db";
import { getModelRate, type KnownModelCatalogEntry } from "@/lib/server/pricing";
import type { LLMProvider } from "@/lib/providers/llm/types";
import { buildSystemProviderForModel } from "@/lib/server/system-provider";

export type ManagedPlanKey = "free" | "launch" | "growth" | "scale" | "enterprise";
export type ManagedModelTier = "economy" | "balanced" | "premium" | "deep";

export interface ManagedModelDefinition extends KnownModelCatalogEntry {
  key: string;
  tier: ManagedModelTier;
  description: string;
  creditRatePer1K: number;
  planKeys: ManagedPlanKey[];
  providerModelId: string;
}

function envModel(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

/**
 * Customer-facing model catalog. Provider credentials stay server-side; the
 * customer only sees the Cortex model name and capability tier.
 */
export function getManagedModelCatalog(): ManagedModelDefinition[] {
  return [
    {
      key: "launch-fast",
      provider: "OpenRouter",
      providerModelId: envModel("CORTEX_MODEL_LAUNCH_FAST", "deepseek/deepseek-v4.1-flash"),
      modelId: envModel("CORTEX_MODEL_LAUNCH_FAST", "deepseek/deepseek-v4.1-flash"),
      displayName: "Cortex Fast",
      description: "سریع و اقتصادی برای پاسخ‌های روزمره",
      qualityTier: "economy",
      speedTier: "fast",
      tier: "economy",
      creditRatePer1K: 1.5,
      planKeys: ["free", "launch", "growth", "scale", "enterprise"],
      tools: true,
      reasoning: true,
    },
    {
      key: "launch-lite",
      provider: "OpenRouter",
      providerModelId: envModel("CORTEX_MODEL_LAUNCH_LITE", "qwen/qwen3.7-flash"),
      modelId: envModel("CORTEX_MODEL_LAUNCH_LITE", "qwen/qwen3.7-flash"),
      displayName: "Cortex Lite",
      description: "اقتصادی‌ترین گزینه برای تست و پاسخ‌های ساده",
      qualityTier: "economy",
      speedTier: "fast",
      tier: "economy",
      creditRatePer1K: 0.75,
      planKeys: ["free", "launch", "growth", "scale", "enterprise"],
      tools: true,
      reasoning: true,
    },
    {
      key: "launch-balanced",
      provider: "OpenRouter",
      providerModelId: envModel("CORTEX_MODEL_LAUNCH_BALANCED", "qwen/qwen3.5-flash-02-23"),
      modelId: envModel("CORTEX_MODEL_LAUNCH_BALANCED", "qwen/qwen3.5-flash-02-23"),
      displayName: "Cortex Smart",
      description: "تعادل سرعت، هزینه و کیفیت",
      qualityTier: "economy",
      speedTier: "fast",
      tier: "economy",
      creditRatePer1K: 1.5,
      planKeys: ["launch", "growth", "scale", "enterprise"],
      tools: true,
      reasoning: true,
    },
    {
      key: "growth-flash",
      provider: "OpenRouter",
      providerModelId: envModel("CORTEX_MODEL_GROWTH_FLASH", "google/gemini-3.8-flash"),
      modelId: envModel("CORTEX_MODEL_GROWTH_FLASH", "google/gemini-3.8-flash"),
      displayName: "Cortex Pro Flash",
      description: "کیفیت بالاتر برای کارهای حرفه‌ای روزمره",
      qualityTier: "balanced",
      speedTier: "fast",
      tier: "balanced",
      creditRatePer1K: 4.5,
      planKeys: ["growth", "scale", "enterprise"],
      tools: true,
      reasoning: true,
      vision: true,
    },
    {
      key: "growth-qwen-max",
      provider: "OpenRouter",
      providerModelId: envModel("CORTEX_MODEL_GROWTH_MAX", "qwen/qwen3.8-max-0902"),
      modelId: envModel("CORTEX_MODEL_GROWTH_MAX", "qwen/qwen3.8-max-0902"),
      displayName: "Cortex Expert",
      description: "تحلیل و استدلال قوی‌تر برای کار تیمی",
      qualityTier: "premium",
      speedTier: "balanced",
      tier: "premium",
      creditRatePer1K: 5,
      planKeys: ["growth", "scale", "enterprise"],
      tools: true,
      reasoning: true,
      vision: true,
    },
    {
      key: "scale-sonnet",
      provider: "OpenRouter",
      providerModelId: envModel("CORTEX_MODEL_SCALE_SONNET", "anthropic/claude-sonnet-5"),
      modelId: envModel("CORTEX_MODEL_SCALE_SONNET", "anthropic/claude-sonnet-5"),
      displayName: "Cortex Reasoning",
      description: "استدلال عمیق برای سناریوهای پیچیده",
      qualityTier: "deep",
      speedTier: "balanced",
      tier: "deep",
      creditRatePer1K: 10,
      planKeys: ["scale", "enterprise"],
      tools: true,
      reasoning: true,
      vision: true,
    },
    {
      key: "enterprise-opus",
      provider: "OpenRouter",
      providerModelId: envModel("CORTEX_MODEL_ENTERPRISE_OPUS", "anthropic/claude-opus-5.5"),
      modelId: envModel("CORTEX_MODEL_ENTERPRISE_OPUS", "anthropic/claude-opus-5.5"),
      displayName: "Cortex Ultra",
      description: "بالاترین سطح مدل برای پروژه‌های سازمانی",
      qualityTier: "deep",
      speedTier: "deep",
      tier: "deep",
      creditRatePer1K: 12,
      planKeys: ["enterprise"],
      tools: true,
      reasoning: true,
      vision: true,
    },
  ];
}

export function findManagedModel(key: string | null | undefined): ManagedModelDefinition | null {
  return getManagedModelCatalog().find((model) => model.key === key) ?? null;
}

export function isModelAllowedForPlan(model: ManagedModelDefinition, planKey: string): boolean {
  return model.planKeys.includes(planKey as ManagedPlanKey);
}

function modelFromCatalog(
  catalog: {
    id: string;
    routeKey: string | null;
    provider: string;
    modelId: string;
    displayName: string;
    qualityTier: string;
    speedTier: string;
    contextWindow: number | null;
    vision: boolean;
    tools: boolean;
    structuredOutput: boolean;
    reasoning: boolean;
    commercialAvailable: boolean;
    trialEnabled: boolean;
    trialDefault: boolean;
  },
): ManagedModelDefinition {
  const staticModel = findManagedModel(catalog.routeKey) ?? findManagedModel(catalog.modelId);
  const qualityTier = (["economy", "balanced", "premium", "deep"].includes(catalog.qualityTier)
    ? catalog.qualityTier
    : "balanced") as ManagedModelTier;
  const speedTier = (["fast", "balanced", "deep"].includes(catalog.speedTier)
    ? catalog.speedTier
    : "balanced") as ManagedModelDefinition["speedTier"];

  return {
    ...(staticModel ?? {
      provider: catalog.provider,
      modelId: catalog.modelId,
      displayName: catalog.displayName,
      qualityTier,
      speedTier,
      contextWindow: catalog.contextWindow ?? undefined,
      vision: catalog.vision,
      tools: catalog.tools,
      structuredOutput: catalog.structuredOutput,
      reasoning: catalog.reasoning,
      commercialAvailable: catalog.commercialAvailable,
    }),
    key: catalog.routeKey ?? catalog.id,
    provider: catalog.provider,
    modelId: catalog.modelId,
    providerModelId: catalog.modelId,
    displayName: catalog.displayName,
    description: staticModel?.description ?? "مدل مدیریت‌شده Cortex",
    tier: qualityTier,
    qualityTier,
    speedTier,
    creditRatePer1K: staticModel?.creditRatePer1K ?? 1.5,
    planKeys: staticModel?.planKeys ?? ["launch", "growth", "scale", "enterprise"],
    contextWindow: catalog.contextWindow ?? staticModel?.contextWindow,
    vision: catalog.vision,
    tools: catalog.tools,
    structuredOutput: catalog.structuredOutput,
    reasoning: catalog.reasoning,
    commercialAvailable: catalog.commercialAvailable,
  };
}

async function loadCatalogForAgent(agentModelKey: string | null | undefined) {
  if (!agentModelKey) {
    return db.modelCatalog.findFirst({
      where: { trialDefault: true, active: true },
      include: { systemProvider: true },
    });
  }

  return db.modelCatalog.findFirst({
    where: {
      active: true,
      OR: [
        { routeKey: agentModelKey },
        { id: agentModelKey },
        { modelId: agentModelKey },
      ],
    },
    include: { systemProvider: true },
  });
}

async function resolveProviderFromCatalog(
  model: {
    id: string;
    provider: string;
    modelId: string;
    systemProvider: Awaited<ReturnType<typeof db.systemProviderConfig.findUnique>>;
  },
  preferTrialProvider = false,
) {
  if (model.systemProvider?.enabled && (!preferTrialProvider || model.systemProvider.isTrialProvider)) {
    return buildSystemProviderForModel(model.systemProvider, model.modelId);
  }
  const byProvider = await db.systemProviderConfig.findFirst({
    where: { providerName: model.provider, enabled: true },
    orderBy: [{ isTrialProvider: preferTrialProvider ? "desc" : "asc" }, { updatedAt: "desc" }],
  });
  if (byProvider) return buildSystemProviderForModel(byProvider, model.modelId);

  // Backward-compatible OpenRouter environment fallback. New production
  // installations should use the admin-managed provider registry instead.
  const legacy = model.provider.toLowerCase() === "openrouter" ? new OpenRouterProvider({ model: model.modelId }) : null;
  return legacy?.isConfigured() ? legacy : null;
}

export async function resolveManagedModelForAgent(agentId: string, workspaceId: string): Promise<{
  model: ManagedModelDefinition;
  provider: LLMProvider;
  planKey: string;
}> {
  const agent = await db.agent.findUnique({ where: { id: agentId }, select: { modelKey: true } });
  const account = await db.workspaceBillingAccount.findUnique({
    where: { workspaceId },
    include: { plan: true },
  });
  if (!account) throw Object.assign(new Error("حساب اعتبار فضای کاری پیدا نشد."), { status: 404 });

  let catalog =
    account.plan.key === "free"
      ? await db.modelCatalog.findFirst({
          where: {
            active: true,
            trialEnabled: true,
            OR: [{ trialDefault: true }, { isTrialDefault: true }],
          },
          include: { systemProvider: true },
          orderBy: [{ trialDefault: "desc" }, { isTrialDefault: "desc" }, { updatedAt: "desc" }],
        })
      : await loadCatalogForAgent(agent?.modelKey);


  if (!catalog) {
    if (account.plan.key === "free") {
      const trialProvider = await db.systemProviderConfig.findFirst({
        where: { enabled: true, isTrialProvider: true },
        orderBy: { updatedAt: "desc" },
      });
      const fallback = findManagedModel("launch-lite") ?? getManagedModelCatalog()[0];
      if (!trialProvider) {
        throw Object.assign(new Error("Provider پیش‌فرض Trial در پیشخوان مدیر تنظیم نشده است."), { status: 503, code: "trial_provider_unavailable" });
      }
      const provider = buildSystemProviderForModel(trialProvider, fallback.providerModelId);
      if (!provider.isConfigured()) {
        throw Object.assign(new Error("Provider پیش‌فرض Trial کلید معتبر ندارد."), { status: 503, code: "trial_provider_unconfigured" });
      }
      return { model: fallback, provider, planKey: account.plan.key };
    }

    const fallback = findManagedModel(agent?.modelKey) ?? getManagedModelCatalog()[0];
    const envProvider = new OpenRouterProvider({ model: fallback.providerModelId });
    const provider = envProvider.isConfigured() ? envProvider : null;
    if (!provider) {
      throw Object.assign(new Error("هیچ Provider مدیریتی برای این مدل فعال نیست."), { status: 503, code: "managed_provider_unavailable" });
    }
    return { model: fallback, provider, planKey: account.plan.key };
  }

  const access = await db.planModelAccess.findUnique({
    where: { planId_modelCatalogId: { planId: account.planId, modelCatalogId: catalog.id } },
  });
  const model = modelFromCatalog(catalog);

  const isAllowed = account.plan.key === "free"
    ? catalog.trialEnabled && Boolean(access?.enabled ?? true)
    : Boolean(access?.enabled);

  if (!isAllowed) {
    throw Object.assign(
      new Error("مدل انتخابی در پلن فعلی در دسترس نیست. برای ادامه، پلن خود را ارتقا دهید."),
      { status: 403, code: "model_not_in_plan" },
    );
  }

  const provider = await resolveProviderFromCatalog(catalog, account.plan.key === "free");
  if (!provider || !provider.isConfigured()) {
    throw Object.assign(
      new Error("Provider این مدل از پنل مدیر پیکربندی نشده یا کلید آن فعال نیست."),
      { status: 503, code: "managed_provider_unavailable" },
    );
  }

  const rate = getModelRate(catalog.provider, catalog.modelId);
  if (!rate.known && catalog.inputUsdPer1M <= 0 && catalog.outputUsdPer1M <= 0) {
    throw Object.assign(
      new Error("قیمت تأمین این مدل در Cortex ثبت نشده است."),
      { status: 503, code: "model_pricing_unavailable" },
    );
  }

  return { model, provider, planKey: account.plan.key };
}
