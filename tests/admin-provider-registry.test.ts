import { beforeEach, describe, expect, it, vi } from "vitest";

const { txCreate } = vi.hoisted(() => ({ txCreate: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: {
    systemProviderConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    modelCatalog: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
    },
    planModelAccess: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(async (callback: any) => callback({
      systemProviderConfig: {
        updateMany: vi.fn(),
        create: txCreate,
        update: vi.fn(),
      },
    })),
  },
}));
vi.mock("@/lib/server/admin-auth", () => ({ requireAdmin: vi.fn(() => "owner") }));
vi.mock("@/lib/server/secrets", () => ({
  encryptSecret: vi.fn((value: string) => "enc:" + value),
  decryptSecret: vi.fn((value: string) => value.replace(/^enc:/, "")),
}));
vi.mock("@/lib/providers/llm/provider-url", () => ({ validateProviderBaseUrl: vi.fn() }));
vi.mock("@/lib/server/system-provider", () => ({
  buildSystemProviderForModel: vi.fn(() => ({
    isConfigured: vi.fn(() => true),
    healthCheck: vi.fn(async () => ({ ok: true, latencyMs: 4, sample: "OK" })),
  })),
}));

import { db } from "@/lib/db";
import { POST, GET } from "@/app/api/control-center/providers/route";

describe("Admin Provider Registry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txCreate.mockResolvedValue({
      id: "provider-1", key: "trial-primary", displayName: "Trial Primary", providerName: "OpenAI",
      protocol: "openai-compatible", authMode: "bearer", baseUrl: "https://api.example.test/v1",
      apiKeyEncrypted: "enc:SECRET", enabled: true, isTrialProvider: true,
    });
  });

  it("stores an API key encrypted and never exposes it through GET", async () => {
    const response = await POST(new Request("http://qa.local/api/control-center/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "create",
        key: "trial-primary",
        displayName: "Trial Primary",
        providerName: "OpenAI",
        protocol: "openai-compatible",
        authMode: "bearer",
        baseUrl: "https://api.example.test/v1",
        apiKey: "SECRET",
        isTrialProvider: true,
      }),
    }));
    expect(response.status).toBe(201);
    const body = await response.json() as any;
    expect(JSON.stringify(body)).not.toContain("SECRET");
    expect(txCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ apiKeyEncrypted: "enc:SECRET", isTrialProvider: true }),
    }));
  });

  it("atomically configures one Trial provider and one Trial default model", async () => {
    vi.mocked(db.systemProviderConfig.findUnique)
      .mockResolvedValueOnce({
        id: "provider-1", key: "trial-primary", displayName: "Trial Primary", providerName: "OpenAI",
        protocol: "openai-compatible", authMode: "bearer", baseUrl: "https://api.example.test/v1",
        apiKeyEncrypted: "enc:SECRET", enabled: true, isTrialProvider: false,
      } as never);
    vi.mocked(db.modelCatalog.findUnique).mockResolvedValue({
      id: "model-1", routeKey: "trial-fast", provider: "OpenAI", modelId: "gpt-test",
      displayName: "Trial Fast", active: true, trialEnabled: false, trialDefault: false,
      systemProviderId: null,
    } as never);
    vi.mocked(db.plan.findUnique).mockResolvedValue({ id: "free-1" } as never);
    const tx = {
      systemProviderConfig: { updateMany: vi.fn(), update: vi.fn() },
      modelCatalog: { updateMany: vi.fn(), update: vi.fn() },
      plan: { findUnique: vi.fn().mockResolvedValue({ id: "free-1" }) },
      planModelAccess: { upsert: vi.fn() },
    };
    vi.mocked(db.$transaction).mockImplementation(async (fn: any) => fn(tx) as never);
    tx.modelCatalog.update.mockResolvedValue({
      id: "model-1", routeKey: "trial-fast", displayName: "Trial Fast", modelId: "gpt-test",
      provider: "OpenAI", active: true, trialEnabled: true, trialDefault: true, systemProviderId: "provider-1",
      systemProvider: { id: "provider-1" },
    });

    const response = await POST(new Request("http://qa.local/api/control-center/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "configure_trial", providerId: "provider-1", modelCatalogId: "model-1" }),
    }));
    expect(response.status).toBe(200);
    expect(tx.systemProviderConfig.updateMany).toHaveBeenCalled();
    expect(tx.modelCatalog.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { trialDefault: false } }));
    expect(tx.modelCatalog.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ systemProviderId: "provider-1", trialEnabled: true, trialDefault: true }),
    }));
    expect(tx.planModelAccess.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ planId: "free-1", modelCatalogId: "model-1", enabled: true }),
    }));
  });

  it("returns provider metadata without the encrypted secret", async () => {
    vi.mocked(db.systemProviderConfig.findMany).mockResolvedValue([{
      id: "provider-1", key: "trial-primary", displayName: "Trial Primary", providerName: "OpenAI",
      protocol: "openai-compatible", authMode: "bearer", baseUrl: "https://api.example.test/v1",
      apiKeyEncrypted: "enc:SECRET", enabled: true, isTrialProvider: true,
      lastHealthStatus: "healthy", lastHealthError: null, lastHealthAt: new Date("2026-09-30"),
      _count: { models: 1 }, models: [{ modelId: "gpt-test" }],
    }] as never);
    const response = await GET(new Request("http://qa.local/api/control-center/providers"));
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(JSON.stringify(body)).not.toContain("SECRET");
    expect(body.data?.providers?.[0]?.testModelId ?? body.providers?.[0]?.testModelId).toBe("gpt-test");
  });
});
