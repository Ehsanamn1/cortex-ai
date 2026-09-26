import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/providers/llm/provider-url", () => ({
  validateProviderBaseUrl: () => undefined,
  assertPublicProviderBaseUrl: async (value: string) => new URL(value),
}));
import { AnthropicProvider } from "@/lib/providers/llm/anthropic";
import { GeminiProvider } from "@/lib/providers/llm/gemini";

afterEach(() => vi.unstubAllGlobals());

describe("direct provider adapters", () => {
  test("Anthropic adapter converts messages and parses text", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain("/v1/messages");
      return new Response(JSON.stringify({ content: [{ type: "text", text: "OK" }] }), { status: 200 });
    }));
    const p = new AnthropicProvider({
      name: "Anthropic",
      baseUrl: "https://api.anthropic.com",
      apiKey: "test-key",
      model: "claude-test",
    });
    const result = await p.generateResponse({ messages: [{ role: "user", content: "hi" }], maxTokens: 8 });
    expect(result.content).toBe("OK");
    expect(result.model).toBe("claude-test");
  });

  test("Gemini adapter uses generateContent and parses text", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const value = String(input);
      expect(value).toContain(":generateContent");
      expect(value).toContain("key=test-key");
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "OK" }] } }],
      }), { status: 200 });
    }));
    const p = new GeminiProvider({
      name: "Gemini",
      baseUrl: "https://generativelanguage.googleapis.com",
      apiKey: "test-key",
      model: "gemini-test",
    });
    const result = await p.generateResponse({ messages: [{ role: "user", content: "hi" }], maxTokens: 8 });
    expect(result.content).toBe("OK");
    expect(result.model).toBe("gemini-test");
  });
});
