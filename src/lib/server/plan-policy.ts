export type CommercialPlanKey = "free" | "launch" | "growth" | "scale" | "enterprise";

export const PLAN_FEATURE_LIMITS: Record<CommercialPlanKey, {
  maxAgents: number | null;
  maxTelegramBots: number | null;
  maxKnowledgeSources: number | null;
}> = {
  free: { maxAgents: 1, maxTelegramBots: null, maxKnowledgeSources: 3 },
  launch: { maxAgents: 2, maxTelegramBots: null, maxKnowledgeSources: 20 },
  growth: { maxAgents: 10, maxTelegramBots: null, maxKnowledgeSources: 100 },
  scale: { maxAgents: 50, maxTelegramBots: null, maxKnowledgeSources: 500 },
  enterprise: { maxAgents: null, maxTelegramBots: null, maxKnowledgeSources: null },
};

export function getPlanFeatureLimits(planKey: string) {
  return PLAN_FEATURE_LIMITS[planKey as CommercialPlanKey] ?? PLAN_FEATURE_LIMITS.free;
}

export function planFeatureError(feature: string) {
  return Object.assign(
    new Error(feature + " در پلن فعلی به سقف رسیده است. برای ادامه، پلن بالاتر را فعال کنید."),
    { status: 403, code: "plan_limit_reached" },
  );
}
