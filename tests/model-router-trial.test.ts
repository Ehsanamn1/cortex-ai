import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    agent: { findUnique: vi.fn() },
    workspaceBillingAccount: { findUnique: vi.fn() },
    modelCatalog: { findFirst: vi.fn() },
    planModelAccess: { findUnique: vi.fn() },
    systemProviderConfig: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/providers/llm/openrouter", () => ({
  OpenRouterProvider: class {
    isConfigured() { return false; }
  },
}));
vi.mock("@/lib/server/pricing", () => ({
  getModelRate: vi.fn(() => ({ inputUsdPer1M: 1, outputUsdPer1M: 1, known: true })),
}));
vi.mock("@/lib/server/system-provider", () => ({
  buildSystemProviderForModel: vi.fn(() => ({
    isConfigured: () => true,
  })),
}));

import { resolveManagedModelForAgent } from "@/lib/server/model-router";

describe("managed model routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the explicitly bound Provider for Trial", async () => {
    dbMock.agent.findUnique.mockResolvedValue({ modelKey: null });
    dbMock.workspaceBillingAccount.findUnique.mockResolvedValue({
      planId: "free-plan",
      plan: { key: "free" },
    });
    dbMock.modelCatalog.findFirst.mockResolvedValue({
      id: "trial-model",
      routeKey: "trial-fast",
      provider: "OpenAI",
      modelId: "gpt-trial",
      displayName: "Trial Fast",
      qualityTier: "economy",
      speedTier: "fast",
      contextWindow: null,
      vision: false,
      tools: true,
      structuredOutput: false,
      reasoning: true,
      commercialAvailable: true,
      active: true,
      trialEnabled: true,
      trialDefault: true,
      systemProviderId: "provider-a",
      systemProvider: {
        id: "provider-a",
        key: "trial-a",
        displayName: "Trial Provider A",
        providerName: "OpenAI",
        protocol: "openai-compatible",
        authMode: "bearer",
        baseUrl: "https://provider-a.example/v1",
        apiKeyEncrypted: "encrypted",
        enabled: true,
        isTrialProvider: true,
      },
    });
    dbMock.planModelAccess.findUnique.mockResolvedValue({ enabled: true, creditMultiplierBps: 100 });

    const result = await resolveManagedModelForAgent("agent-1", "ws-1");
    expect(result.planKey).toBe("free");
    expect(result.provider).toBeTruthy();
    expect(dbMock.systemProviderConfig.findFirst).not.toHaveBeenCalled();
  });

  it("fails a Trial route when no explicit default model exists", async () => {
    dbMock.agent.findUnique.mockResolvedValue({ modelKey: null });
    dbMock.workspaceBillingAccount.findUnique.mockResolvedValue({
      planId: "free-plan",
      plan: { key: "free" },
    });
    dbMock.modelCatalog.findFirst.mockResolvedValue(null);

    await expect(resolveManagedModelForAgent("agent-2", "ws-2")).rejects.toMatchObject({
      status: 503,
      code: "trial_route_unconfigured",
    });
    expect(dbMock.systemProviderConfig.findFirst).not.toHaveBeenCalled();
  });

  it("does not cross-fallback when the explicitly bound Provider is disabled", async () => {
    dbMock.agent.findUnique.mockResolvedValue({ modelKey: null });
    dbMock.workspaceBillingAccount.findUnique.mockResolvedValue({
      planId: "free-plan",
      plan: { key: "free" },
    });
    dbMock.modelCatalog.findFirst.mockResolvedValue({
      id: "trial-model",
      routeKey: "trial-fast",
      provider: "OpenAI",
      modelId: "gpt-trial",
      displayName: "Trial Fast",
      qualityTier: "economy",
      speedTier: "fast",
      contextWindow: null,
      vision: false,
      tools: true,
      structuredOutput: false,
      reasoning: true,
      commercialAvailable: true,
      active: true,
      trialEnabled: true,
      trialDefault: true,
      systemProviderId: "provider-a",
      systemProvider: {
        id: "provider-a",
        key: "trial-a",
        displayName: "Trial Provider A",
        providerName: "OpenAI",
        protocol: "openai-compatible",
        authMode: "bearer",
        baseUrl: "https://provider-a.example/v1",
        apiKeyEncrypted: "encrypted",
        enabled: false,
        isTrialProvider: true,
      },
    });
    dbMock.planModelAccess.findUnique.mockResolvedValue({ enabled: true, creditMultiplierBps: 100 });

    await expect(resolveManagedModelForAgent("agent-3", "ws-3")).rejects.toMatchObject({
      status: 503,
      code: "managed_provider_unavailable",
    });
    expect(dbMock.systemProviderConfig.findFirst).not.toHaveBeenCalled();
  });
});
