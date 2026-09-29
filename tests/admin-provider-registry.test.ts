import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    systemProviderConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(async (callback: any) => callback({
      systemProviderConfig: {
        updateMany: vi.fn(),
        create: vi.fn(),
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
    vi.mocked(db.systemProviderConfig.create).mockResolvedValue({
      id: "provider-1", key: "trial-primary", displayName: "Trial Primary", providerName: "OpenAI",
      protocol: "openai-compatible", authMode: "bearer", baseUrl: "https://api.example.test/v1",
      apiKeyEncrypted: "enc:SECRET", enabled: true, isTrialProvider: true,
    } as never);
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
    expect(vi.mocked(db.systemProviderConfig.create)).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ apiKeyEncrypted: "enc:SECRET", isTrialProvider: true }),
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
