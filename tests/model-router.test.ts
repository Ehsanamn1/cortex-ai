import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    workspaceBillingAccount: { findUnique: vi.fn() },
    agent: { findUnique: vi.fn() },
    planModelAccess: { findMany: vi.fn() },
    systemProviderConfig: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/server/secrets", () => ({
  decryptSecret: vi.fn(() => "qa-trial-key"),
}));

import { db } from "@/lib/db";
import { resolveManagedModelForAgent } from "@/lib/server/model-router";

const trialProvider = {
  id: "provider-trial",
  key: "trial-gateway",
  displayName: "Trial Gateway",
  providerName: "Trial Gateway",
  protocol: "openai-compatible",
  authMode: "bearer",
  baseUrl: "https://trial.example/v1",
  apiKeyEncrypted: "encrypted",
  enabled: true,
  isTrialProvider: true,
};

const trialModel = {
  id: "model-trial",
  provider: "Trial Gateway",
  modelId: "trial-chat",
  displayName: "Trial Chat",
  inputUsdPer1M: 0.03,
  outputUsdPer1M: 0.12,
  contextWindow: 32000,
  vision: false,
  tools: true,
  structuredOutput: true,
  reasoning: false,
  qualityTier: "economy",
  speedTier: "fast",
  commercialAvailable: true,
  active: true,
  isTrialDefault: true,
  systemProviderId: trialProvider.id,
  systemProvider: trialProvider,
  createdAt: new Date(),
  updatedAt: new Date(),
  planAccess: [{ planId: "plan-free", enabled: true, creditMultiplierBps: 200 }],
};

describe("managed model runtime resolution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forces the admin-selected Trial default model for the free plan", async () => {
    vi.mocked(db.workspaceBillingAccount.findUnique).mockResolvedValue({
      id: "account-free",
      workspaceId: "workspace-free",
      planId: "plan-free",
      plan: { key: "free" },
    } as never);
    vi.mocked(db.agent.findUnique).mockResolvedValue({
      id: "agent-free",
      modelKey: "some-paid-model",
    } as never);
    vi.mocked(db.planModelAccess.findMany).mockResolvedValue([
      { planId: "plan-free", enabled: true, modelCatalog: trialModel },
    ] as never);

    const result = await resolveManagedModelForAgent("agent-free", "workspace-free");

    expect(result.planKey).toBe("free");
    expect(result.model.catalogId).toBe("model-trial");
    expect(result.model.modelId).toBe("trial-chat");
    expect(result.provider.name).toBe("Trial Gateway");
    expect(db.systemProviderConfig.findFirst).not.toHaveBeenCalled();
  });

  it("uses the selected paid model only when that model is active in the plan", async () => {
    const paidModel = {
      ...trialModel,
      id: "model-paid",
      displayName: "Paid Chat",
      modelId: "paid-chat",
      isTrialDefault: false,
      systemProvider: { ...trialProvider, isTrialProvider: false, id: "provider-paid", providerName: "Paid Gateway" },
      systemProviderId: "provider-paid",
      provider: "Paid Gateway",
    };
    vi.mocked(db.workspaceBillingAccount.findUnique).mockResolvedValue({
      id: "account-growth",
      workspaceId: "workspace-growth",
      planId: "plan-growth",
      plan: { key: "growth" },
    } as never);
    vi.mocked(db.agent.findUnique).mockResolvedValue({
      id: "agent-growth",
      modelKey: "model-paid",
    } as never);
    vi.mocked(db.planModelAccess.findMany).mockResolvedValue([
      { planId: "plan-growth", enabled: true, modelCatalog: paidModel },
    ] as never);

    const result = await resolveManagedModelForAgent("agent-growth", "workspace-growth");

    expect(result.planKey).toBe("growth");
    expect(result.model.catalogId).toBe("model-paid");
    expect(result.provider.name).toBe("Paid Gateway");
  });
});
