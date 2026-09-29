import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    modelCatalog: { findUnique: vi.fn() },
    systemProviderConfig: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/server/secrets", () => ({
  decryptSecret: vi.fn(() => "qa-api-key"),
}));

import { db } from "@/lib/db";
import { buildSystemProviderForModel, resolveSystemProviderForModel } from "@/lib/server/system-provider";

describe("system Provider registry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds an injected OpenAI-compatible provider from admin values", () => {
    const provider = buildSystemProviderForModel({
      id: "provider-1",
      key: "primary",
      displayName: "Primary Gateway",
      providerName: "Primary Gateway",
      protocol: "openai-compatible",
      authMode: "bearer",
      baseUrl: "https://gateway.example/v1",
      apiKeyEncrypted: "encrypted",
      enabled: true,
      isTrialProvider: false,
    }, "model-a");

    expect(provider.name).toBe("Primary Gateway");
    expect(provider.model()).toBe("model-a");
    expect(provider.isConfigured()).toBe(true);
  });

  it("passes the admin OpenRouter Base URL and key instead of env-only defaults", () => {
    const provider = buildSystemProviderForModel({
      id: "provider-2",
      key: "trial",
      displayName: "Trial Router",
      providerName: "OpenRouter",
      protocol: "openrouter",
      authMode: "bearer",
      baseUrl: "https://router.example/api/v1",
      apiKeyEncrypted: "encrypted",
      enabled: true,
      isTrialProvider: true,
    }, "demo-model");

    expect(provider.name).toBe("openrouter");
    expect(provider.model()).toBe("demo-model");
    expect(provider.isConfigured()).toBe(true);
  });

  it("prefers the model's explicitly bound enabled Provider", async () => {
    vi.mocked(db.modelCatalog.findUnique).mockResolvedValue({
      id: "model-1",
      provider: "Acme",
      modelId: "acme-chat",
      systemProvider: {
        id: "provider-1",
        key: "acme",
        displayName: "Acme Gateway",
        providerName: "Acme",
        protocol: "openai-compatible",
        authMode: "bearer",
        baseUrl: "https://acme.example/v1",
        apiKeyEncrypted: "encrypted",
        enabled: true,
        isTrialProvider: false,
      },
    } as never);

    const result = await resolveSystemProviderForModel("model-1");

    expect(result?.provider?.name).toBe("Acme");
    expect(db.systemProviderConfig.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to the latest enabled Provider for the model Provider name", async () => {
    vi.mocked(db.modelCatalog.findUnique).mockResolvedValue({
      id: "model-2",
      provider: "OpenAI-like",
      modelId: "chat",
      systemProvider: null,
    } as never);
    vi.mocked(db.systemProviderConfig.findFirst).mockResolvedValue({
      id: "provider-2",
      key: "fallback",
      displayName: "Fallback Gateway",
      providerName: "OpenAI-like",
      protocol: "openai-compatible",
      authMode: "x-api-key",
      baseUrl: "https://fallback.example/v1",
      apiKeyEncrypted: "encrypted",
      enabled: true,
      isTrialProvider: false,
    } as never);

    const result = await resolveSystemProviderForModel("model-2");

    expect(result?.provider?.name).toBe("OpenAI-like");
    expect(db.systemProviderConfig.findFirst).toHaveBeenCalledOnce();
  });
});
