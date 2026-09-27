import { describe, expect, test, vi } from "vitest";
import { estimateLlmCostMicros, getModelRate, PRICING_VERIFIED_AT } from "@/lib/server/pricing";

describe("Cortex pricing estimates", () => {
  test("supports current GPT-6 Astra pricing", () => {
    expect(getModelRate("OpenAI", "gpt-6-astra")).toMatchObject({ inputUsdPer1M: 10, outputUsdPer1M: 50, known: true });
    expect(estimateLlmCostMicros(1_000_000, 1_000_000, "OpenAI", "gpt-6-astra")).toBe(60_000_000);
  });

  test("uses verified GPT-5.5 pricing snapshot", () => {
    expect(getModelRate("OpenAI", "gpt-5.5")).toMatchObject({ inputUsdPer1M: 5, outputUsdPer1M: 30, known: true });
    expect(estimateLlmCostMicros(1_000_000, 1_000_000, "OpenAI", "gpt-5.5")).toBe(35_000_000);
  });
  test("supports routed OpenRouter model IDs", () => {
    expect(getModelRate("OpenRouter", "openai/gpt-5.5")).toMatchObject({ inputUsdPer1M: 5, outputUsdPer1M: 30, known: true });
  });
  test("uses verified Anthropic and Google public rates", () => {
    expect(getModelRate("Anthropic", "claude-sonnet-5")).toMatchObject({ inputUsdPer1M: 2, outputUsdPer1M: 10, known: true });
    expect(getModelRate("Anthropic", "claude-opus-5-5")).toMatchObject({ inputUsdPer1M: 4, outputUsdPer1M: 20, known: true });
    expect(getModelRate("Google", "gemini-3.7-flash")).toMatchObject({ inputUsdPer1M: 0.75, outputUsdPer1M: 3.75, known: true });
  });
  test("uses verified DeepSeek V4 off-peak base pricing", () => {
    expect(getModelRate("DeepSeek", "deepseek-v4-pro")).toMatchObject({ inputUsdPer1M: 0.66, outputUsdPer1M: 1.98, known: true });
    expect(getModelRate("DeepSeek", "deepseek-flash")).toMatchObject({ inputUsdPer1M: 0.15, outputUsdPer1M: 0.6, known: true });
  });
  test("exposes the pricing verification date", () => {
    expect(PRICING_VERIFIED_AT).toBe("2026-09-28");
  });
  test("publishes a 25-model recognized catalog", () => {
    const { getKnownModelCatalog } = require("@/lib/server/pricing");
    expect(getKnownModelCatalog()).toHaveLength(25);
  });

  test("uses environment fallback for an unknown configured model", () => {
    vi.stubEnv("CORTEX_INPUT_USD_PER_1M", "0.4");
    vi.stubEnv("CORTEX_OUTPUT_USD_PER_1M", "3");
    expect(getModelRate("custom", "my-model")).toMatchObject({ inputUsdPer1M: 0.4, outputUsdPer1M: 3, known: false });
    expect(estimateLlmCostMicros(1000, 1000, "custom", "my-model")).toBe(3400);
    vi.unstubAllEnvs();
  });
});
