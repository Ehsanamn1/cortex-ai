import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    agent: { findUnique: vi.fn() },
    modelCatalog: { findUnique: vi.fn(), findFirst: vi.fn() },
    workspaceBillingAccount: { findUnique: vi.fn() },
    planModelAccess: { findUnique: vi.fn() },
    systemProviderConfig: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/providers/llm/openrouter", () => ({
  OpenRouterProvider: class {
    model() { return "test-model"; }
    isConfigured() { return true; }
  },
}));
vi.mock("@/lib/server/system-provider", () => ({
  buildSystemProviderForModel: vi.fn(() => ({ isConfigured: () => true })),
}));
vi.mock("@/lib/server/pricing", () => ({
  getModelRate: vi.fn(() => ({ known: true, inputUsdPer1M: 0.03, outputUsdPer1M: 0.13 })),
}));
import { db } from "@/lib/db";
import { resolveManagedModelForAgent } from "@/lib/server/model-router";

describe("Central model routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.agent.findUnique).mockResolvedValue({ modelKey: null } as never);
  });

  it("routes a Trial agent to the admin-selected default catalog model", async () => {
    vi.mocked(db.modelCatalog.findUnique).mockResolvedValue({
      id: "catalog-trial", routeKey: "trial-default", provider: "TrialProvider", modelId: "trial-model",
      displayName: "Trial", qualityTier: "economy", speedTier: "fast", contextWindow: null,
      vision: false, tools: true, structuredOutput: false, reasoning: false,
      commercialAvailable: false, trialEnabled: true, trialDefault: true,
      systemProvider: {
        id: "provider-trial", key: "trial", displayName: "Trial Provider", providerName: "TrialProvider",
        protocol: "openai-compatible", authMode: "bearer", baseUrl: "https://trial.example/v1",
        apiKeyEncrypted: "enc:key", enabled: true, isTrialProvider: true,
      },
    } as never);
    vi.mocked(db.workspaceBillingAccount.findUnique).mockResolvedValue({
      planId: "plan-free", plan: { key: "free" },
    } as never);
    vi.mocked(db.planModelAccess.findUnique).mockResolvedValue({ enabled: true, creditMultiplierBps: 100 } as never);
    vi.mocked(db.modelCatalog.findFirst).mockResolvedValue(null);

    const result = await resolveManagedModelForAgent("agent-1", "workspace-1");
    expect(result.planKey).toBe("free");
    expect(result.model.provider).toBe("TrialProvider");
    expect(result.model.providerModelId).toBe("trial-model");
    expect(result.provider.isConfigured()).toBe(true);
  });
});
