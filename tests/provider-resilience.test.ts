import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    agentProviderConfig: { findUnique: vi.fn() },
    providerConfig: { findUnique: vi.fn() },
    agentProviderHealth: { upsert: vi.fn(async () => ({})) },
  },
}));

vi.mock("@/lib/server/secrets", () => ({ decryptSecret: vi.fn((v:string) => v) }));

import { db } from "@/lib/db";
import { llmManager } from "@/lib/providers/llm/manager";
import { ProviderUnavailableError, classifyProviderFailure } from "@/lib/providers/llm/types";

describe("provider resilience simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubGlobal("fetch", vi.fn());
  });

  test("classifies transient, auth, timeout and malformed failures distinctly", () => {
    expect(classifyProviderFailure(new Error("provider http 429"), "x").code).toBe("provider_429");
    expect(classifyProviderFailure(new Error("provider http 503"), "x").code).toBe("provider_5xx");
    expect(classifyProviderFailure(new Error("timeout while waiting"), "x").code).toBe("provider_timeout");
    expect(classifyProviderFailure(new Error("401 unauthorized"), "x").code).toBe("provider_auth_failed");
    expect(classifyProviderFailure(new Error("Unexpected token in JSON"), "x").code).toBe("provider_invalid_response");
  });

  test("opens a circuit after repeated transient failures and prevents another upstream call", async () => {
    vi.mocked(db.agentProviderConfig.findUnique).mockResolvedValue({
      id:"cfg-1", agentId:"agent-1", workspaceId:"ws-1", providerName:"Anthropic",
      baseUrl:"https://api.anthropic.com", model:"claude-test", protocol:"anthropic",
      authMode:"x-api-key", apiKeyEncrypted:"secret", enabled:true,
    } as never);

    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(new Response("upstream unavailable", { status: 503 }));

    const first = await llmManager.resolveForAgent("agent-1", "ws-1");
    expect(first.provider).not.toBeNull();

    await expect(first.provider!.generateResponse({ messages:[{ role:"user",content:"ping" }] }))
      .rejects.toBeInstanceOf(ProviderUnavailableError);

    expect(fetchMock).toHaveBeenCalledTimes(3);

    await expect(first.provider!.generateResponse({ messages:[{ role:"user",content:"ping again" }] }))
      .rejects.toMatchObject({ code:"provider_circuit_open" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(vi.mocked(db.agentProviderHealth.upsert)).toHaveBeenCalled();
  });
});
