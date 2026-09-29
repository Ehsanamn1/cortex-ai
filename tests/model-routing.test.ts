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

  it("ignores an Agent's stale model selection on the Trial plan", async () => {
    vi.mocked(db.modelCatalog.findFirst).mockResolvedValue({
      id: "catalog-trial-default", routeKey: "trial-default", provider: "TrialProvider", modelId: "trial-chat",
      displayName: "Trial Default", qualityTier: "economy", speedTier: "fast", contextWindow: null,
      vision: false, tools: true, structuredOutput: false, reasoning: false,
      commercialAvailable: true, trialEnabled: true, trialDefault: true, isTrialDefault: false,
      systemProvider: {
        id: "provider-trial", key: "trial", displayName: "Trial Provider", providerName: "TrialProvider",
        protocol: "openai-compatible", authMode: "bearer", baseUrl: "https://trial.example/v1",
        apiKeyEncrypted: "enc:key", enabled: true, isTrialProvider: true,
      },
    } as never);
    vi.mocked(db.workspaceBillingAccount.findUnique).mockResolvedValue({
      planId: "plan-free", plan: { key: "free" },
    } as never);
    vi.mocked(db.agent.findUnique).mockResolvedValue({ modelKey: "paid-model-that-must-be-ignored" } as never);
    vi.mocked(db.planModelAccess.findUnique).mockResolvedValue({ enabled: true, creditMultiplierBps: 100 } as never);

    const result = await resolveManagedModelForAgent("agent-1", "workspace-1");

    expect(result.model.modelId).toBe("trial-chat");
    expect(result.model.displayName).toBe("Trial Default");
    expect(vi.mocked(db.modelCatalog.findFirst)).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        trialEnabled: true,
        OR: [{ trialDefault: true }, { isTrialDefault: true }],
      }),
    }));
  });

  it("uses the central Trial Provider if the default model points to another provider", async () => {
    vi.mocked(db.modelCatalog.findFirst).mockResolvedValue({
      id: "catalog-trial", routeKey: "trial-default", provider: "TrialProvider", modelId: "trial-model",
      displayName: "Trial", qualityTier: "economy", speedTier: "fast", contextWindow: null,
      vision: false, tools: true, structuredOutput: false, reasoning: false,
      commercialAvailable: true, trialEnabled: true, trialDefault: true,
      systemProvider: {
        id: "provider-wrong", key: "wrong", displayName: "Wrong", providerName: "WrongProvider",
        protocol: "openai-compatible", authMode: "bearer", baseUrl: "https://wrong.example/v1",
        apiKeyEncrypted: "enc:key", enabled: true, isTrialProvider: false,
      },
    } as never);
    vi.mocked(db.workspaceBillingAccount.findUnique).mockResolvedValue({
      planId: "plan-free", plan: { key: "free" },
    } as never);
    vi.mocked(db.planModelAccess.findUnique).mockResolvedValue({ enabled: true, creditMultiplierBps: 100 } as never);
    vi.mocked(db.systemProviderConfig.findFirst).mockResolvedValue({
      id: "provider-central", key: "central", displayName: "Central Trial", providerName: "CentralProvider",
      protocol: "openai-compatible", authMode: "bearer", baseUrl: "https://central.example/v1",
      apiKeyEncrypted: "enc:key", enabled: true, isTrialProvider: true,
    } as never);

    const { buildSystemProviderForModel } = await import("@/lib/server/system-provider");
    const result = await resolveManagedModelForAgent("agent-1", "workspace-1");

    expect(result.provider.isConfigured()).toBe(true);
    expect(vi.mocked(buildSystemProviderForModel)).toHaveBeenCalledWith(
      expect.objectContaining({ id: "provider-central", isTrialProvider: true }),
      "trial-model",
    );
  });

  it("routes a Trial agent to the admin-selected default catalog model", async () => {
    vi.mocked(db.modelCatalog.findFirst).mockResolvedValue({
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
    const result = await resolveManagedModelForAgent("agent-1", "workspace-1");
    expect(result.planKey).toBe("free");
    expect(result.model.provider).toBe("TrialProvider");
    expect(result.model.providerModelId).toBe("trial-model");
    expect(result.provider.isConfigured()).toBe(true);
  });
  it("falls back to the central Trial Provider before the catalog is warmed", async () => {
    vi.mocked(db.modelCatalog.findFirst).mockResolvedValue(null);
    vi.mocked(db.workspaceBillingAccount.findUnique).mockResolvedValue({
      planId: "plan-free", plan: { key: "free" },
    } as never);
    vi.mocked(db.systemProviderConfig.findFirst).mockResolvedValue({
      id: "provider-central", key: "central", displayName: "Central Trial", providerName: "CentralProvider",
      protocol: "openai-compatible", authMode: "bearer", baseUrl: "https://central.example/v1",
      apiKeyEncrypted: "enc:key", enabled: true, isTrialProvider: true,
    } as never);

    const { buildSystemProviderForModel } = await import("@/lib/server/system-provider");
    const result = await resolveManagedModelForAgent("agent-1", "workspace-1");

    expect(result.planKey).toBe("free");
    expect(result.model.key).toBe("launch-lite");
    expect(vi.mocked(buildSystemProviderForModel)).toHaveBeenCalledWith(
      expect.objectContaining({ id: "provider-central", isTrialProvider: true }),
      result.model.providerModelId,
    );
  });

});
