import { OpenRouterProvider } from "@/lib/providers/llm/openrouter";
import { db } from "@/lib/db";
import { getModelRate, type KnownModelCatalogEntry } from "@/lib/server/pricing";
import type { LLMProvider } from "@/lib/providers/llm/types";
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

export async function resolveManagedModelForAgent(agentId: string, workspaceId: string): Promise<{
  model: ManagedModelDefinition & { catalogId: string; systemProviderId: string | null };
  provider: LLMProvider;
  planKey: string;
}> {
  const account = await db.workspaceBillingAccount.findUnique({
    where: { workspaceId },
    include: { plan: true },
  });
  if (!account) throw Object.assign(new Error("حساب اعتبار فضای کاری پیدا نشد."), { status: 404 });

  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: { modelKey: true },
  });

  const catalogModels = await db.modelCatalog.findMany({
    where: {
      active: true,
      commercialAvailable: true,
      planAccess: { some: { planId: account.planId, enabled: true } },
    },
    include: { systemProvider: true, planAccess: { where: { planId: account.planId, enabled: true } } },
    orderBy: [{ isTrialDefault: "desc" }, { updatedAt: "desc" }],
  });

  const staticKey = findManagedModel(agent?.modelKey);
  const requested = agent?.modelKey
    ? catalogModels.find((item) => item.id === agent.modelKey)
      ?? (staticKey
        ? catalogModels.find((item) => item.provider === staticKey.provider && item.modelId === staticKey.providerModelId)
        : undefined)
    : undefined;

  let selected = requested;

  if (!selected) {
    selected = catalogModels.find((item) => item.isTrialDefault && item.systemProvider?.enabled && item.systemProvider?.isTrialProvider)
      ?? catalogModels.find((item) => item.systemProvider?.enabled && item.systemProvider?.isTrialProvider);
  }

  if (!selected) {
    throw Object.assign(
      new Error("هیچ مدل فعالی برای پلن فعلی از سمت پیشخوان مدیر متصل نشده است."),
      { status: 503, code: "managed_model_unavailable" },
    );
  }

  const providerRecord = selected.systemProvider?.enabled
    ? selected.systemProvider
    : await db.systemProviderConfig.findFirst({
        where: { providerName: selected.provider, enabled: true },
        orderBy: [{ isTrialProvider: "desc" }, { updatedAt: "desc" }],
      });

  if (!providerRecord) {
    throw Object.assign(
      new Error("Provider مدل «" + selected.displayName + "» از سمت پیشخوان مدیر متصل نشده است."),
      { status: 503, code: "managed_provider_unavailable" },
    );
  }

  const provider = requireSystemProviderForModel(providerRecord, selected.modelId);
  if (!provider.isConfigured()) {
    throw Object.assign(
      new Error("Provider مدل «" + selected.displayName + "» تنظیمات معتبر ندارد."),
      { status: 503, code: "managed_provider_unavailable" },
    );
  }

  const staticModel = findManagedModelByProvider(selected.provider, selected.modelId);
  return {
    model: {
      ...selected,
      catalogId: selected.id,
      systemProviderId: selected.systemProviderId,
      provider: selected.provider,
      modelId: selected.modelId,
      displayName: selected.displayName,
      description: staticModel?.description ?? "مدل مدیریت‌شده توسط پیشخوان Cortex",
      tier: (selected.qualityTier as ManagedModelTier) || "balanced",
      creditRatePer1K: staticModel?.creditRatePer1K ?? 1,
      planKeys: ["free", "launch", "growth", "scale", "enterprise"],
      providerModelId: selected.modelId,
      speedTier: selected.speedTier,
      qualityTier: selected.qualityTier,
      tools: selected.tools,
      reasoning: selected.reasoning,
      vision: selected.vision,
    } as ManagedModelDefinition & { catalogId: string; systemProviderId: string | null },
    provider,
    planKey: account.plan.key,
  };
}

function findManagedModelByProvider(provider: string, modelId: string): ManagedModelDefinition | null {
  return getManagedModelCatalog().find(
    (model) => model.provider === provider && model.providerModelId.toLowerCase() === modelId.toLowerCase(),
  ) ?? null;
}

import { buildSystemProviderForModel as requireSystemProviderForModel } from "@/lib/server/system-provider";
