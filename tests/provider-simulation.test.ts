import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    agentProviderConfig: { findUnique: vi.fn() },
    providerConfig: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/server/secrets", () => ({
  decryptSecret: vi.fn((value: string) => value),
}));

import { db } from "@/lib/db";
import { ProviderUnavailableError } from "@/lib/providers/llm/types";
import { OpenAICompatibleProvider } from "@/lib/providers/llm/openai-compatible";
import { validateProviderBaseUrl } from "@/lib/providers/llm/provider-url";
import { llmManager } from "@/lib/providers/llm/manager";

const mockAgentConfig = (overrides: Record<string, unknown> = {}) => ({
  id: "agent-provider-1",
  agentId: "agent-1",
  workspaceId: "workspace-1",
  providerName: "Mock Provider",
  baseUrl: "https://provider.example/v1",
  model: "mock-model",
  authMode: "bearer",
  apiKeyEncrypted: "agent-secret",
  enabled: true,
  ...overrides,
});

function mockCompletion(content: unknown = "سلام از Provider") {
  return {
    choices: [{ message: { content } }],
  };
}

describe("OpenAI-compatible provider simulation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("sends Bearer authentication, model, messages and generation settings", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer secret-123");
      expect(headers.get("content-type")).toContain("application/json");

      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("mock-model");
      expect(body.temperature).toBe(0.2);
      expect(body.max_tokens).toBe(128);
      expect(body.messages).toEqual([
        { role: "system", content: "You are Cortex." },
        { role: "user", content: "سلام" },
      ]);

      return new Response(JSON.stringify(mockCompletion("پاسخ تستی")), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAICompatibleProvider({
      name: "Mock Provider",
      baseUrl: "https://provider.example/v1/",
      apiKey: "secret-123",
      model: "mock-model",
      authMode: "bearer",
    });

    const result = await provider.generateResponse({
      messages: [
        { role: "system", content: "You are Cortex." },
        { role: "user", content: "سلام" },
      ],
      temperature: 0.2,
      maxTokens: 128,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toEqual({
      content: "پاسخ تستی",
      provider: "Mock Provider",
      model: "mock-model",
    });
  });

  test("supports X-API-Key and no-auth modes", async () => {
    const calls: Headers[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Headers(init?.headers));
      return new Response(JSON.stringify(mockCompletion("OK")), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    const xApiProvider = new OpenAICompatibleProvider({
      name: "X-Key",
      baseUrl: "https://provider.example/v1",
      apiKey: "x-secret",
      model: "x-model",
      authMode: "x-api-key",
    });
    await xApiProvider.generateResponse({ messages: [{ role: "user", content: "ping" }] });

    const noAuthProvider = new OpenAICompatibleProvider({
      name: "Public",
      baseUrl: "https://provider.example/v1",
      model: "public-model",
      authMode: "none",
    });
    await noAuthProvider.generateResponse({ messages: [{ role: "user", content: "ping" }] });

    expect(calls[0]?.get("x-api-key")).toBe("x-secret");
    expect(calls[0]?.get("authorization")).toBeNull();
    expect(calls[1]?.get("authorization")).toBeNull();
    expect(calls[1]?.get("x-api-key")).toBeNull();
  });

  test("accepts OpenAI-style array content returned by some gateways", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(
        JSON.stringify(mockCompletion([
          { type: "text", text: "بخش اول " },
          { type: "text", text: "بخش دوم" },
        ])),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    ));

    const provider = new OpenAICompatibleProvider({
      name: "Mock",
      baseUrl: "https://provider.example/v1",
      apiKey: "secret",
      model: "mock-model",
    });

    await expect(provider.generateResponse({ messages: [{ role: "user", content: "x" }] }))
      .resolves.toMatchObject({ content: "بخش اول بخش دوم" });
  });

  test("turns provider HTTP failures, malformed JSON and empty completions into safe provider errors", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("upstream failed", { status: 500 }))
      .mockResolvedValueOnce(new Response("{not-json", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [] }), { status: 200 }))
    );

    const provider = new OpenAICompatibleProvider({
      name: "Mock",
      baseUrl: "https://provider.example/v1",
      apiKey: "secret",
      model: "mock-model",
    });

    await expect(provider.generateResponse({ messages: [{ role: "user", content: "x" }] }))
      .rejects.toBeInstanceOf(ProviderUnavailableError);
    await expect(provider.generateResponse({ messages: [{ role: "user", content: "x" }] }))
      .rejects.toBeInstanceOf(ProviderUnavailableError);
    await expect(provider.generateResponse({ messages: [{ role: "user", content: "x" }] }))
      .rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  test("healthCheck performs a real generation round trip", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(mockCompletion("OK")), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAICompatibleProvider({
      name: "Health Provider",
      baseUrl: "https://provider.example/v1",
      apiKey: "secret",
      model: "health-model",
    });

    await expect(provider.healthCheck()).resolves.toMatchObject({
      ok: true,
      sample: "OK",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("preserves the configured Base URL path and rejects private targets", async () => {
    expect(validateProviderBaseUrl("https://provider.example/v1/").toString())
      .toBe("https://provider.example/v1/");
    expect(() => validateProviderBaseUrl("http://127.0.0.1:8080/v1")).toThrow();
    expect(() => validateProviderBaseUrl("http://localhost:3000/v1")).toThrow();
    expect(() => validateProviderBaseUrl("http://169.254.169.254/latest")).toThrow();

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://provider.example/v1/chat/completions");
      return new Response(JSON.stringify(mockCompletion("مسیر درست")), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAICompatibleProvider({
      name: "Path Provider",
      baseUrl: "https://provider.example/v1/",
      apiKey: "secret",
      model: "mock-model",
    });

    await expect(provider.generateResponse({ messages: [{ role: "user", content: "x" }] }))
      .resolves.toMatchObject({ content: "مسیر درست" });
  });

  test("missing credentials make the provider unusable before any network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAICompatibleProvider({
      name: "Missing Key",
      baseUrl: "https://provider.example/v1",
      model: "mock-model",
      authMode: "bearer",
    });

    expect(provider.isConfigured()).toBe(false);
    await expect(provider.generateResponse({ messages: [{ role: "user", content: "x" }] }))
      .rejects.toThrow("پیکربندی نشده");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("agent-level provider resolution simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LLM_PROVIDER", "none");
    vi.unstubAllGlobals();
  });

  test("uses the agent provider instead of the workspace provider", async () => {
    vi.mocked(db.agentProviderConfig.findUnique).mockResolvedValue(mockAgentConfig() as never);
    vi.mocked(db.providerConfig.findUnique).mockResolvedValue(mockAgentConfig({
      providerName: "Legacy Workspace",
      apiKeyEncrypted: "legacy-secret",
      model: "legacy-model",
    }) as never);

    const { provider, status } = await llmManager.resolveForAgent("agent-1", "workspace-1");

    expect(provider).not.toBeNull();
    expect(provider?.name).toBe("Mock Provider");
    expect(provider?.model()).toBe("mock-model");
    expect(status.source).toBe("agent");
    expect(db.providerConfig.findUnique).not.toHaveBeenCalled();
  });

  test("does not silently fall back when an explicitly configured agent provider is disabled", async () => {
    vi.mocked(db.agentProviderConfig.findUnique).mockResolvedValue(mockAgentConfig({ enabled: false }) as never);
    vi.mocked(db.providerConfig.findUnique).mockResolvedValue(mockAgentConfig({
      providerName: "Legacy Workspace",
      apiKeyEncrypted: "legacy-secret",
      model: "legacy-model",
    }) as never);

    const { provider, status } = await llmManager.resolveForAgent("agent-1", "workspace-1");

    expect(provider).toBeNull();
    expect(status.status).toBe("not_configured");
  });

  test("keeps legacy workspace fallback only when the agent has no agent-level config", async () => {
    vi.mocked(db.agentProviderConfig.findUnique).mockResolvedValue(null);
    vi.mocked(db.providerConfig.findUnique).mockResolvedValue(mockAgentConfig({
      providerName: "Legacy Workspace",
      apiKeyEncrypted: "legacy-secret",
      model: "legacy-model",
    }) as never);

    const { provider, status } = await llmManager.resolveForAgent("agent-1", "workspace-1");

    expect(provider?.name).toBe("Legacy Workspace");
    expect(status.source).toBe("workspace");
  });
});
