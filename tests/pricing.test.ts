import { describe, expect, test, vi } from "vitest";
import { estimateLlmCostMicros, getModelRate } from "@/lib/server/pricing";

describe("Cortex pricing estimates", () => {
  test("uses current documented GPT-5 mini rate", () => {
    expect(getModelRate("OpenAI", "gpt-5-mini")).toMatchObject({ inputUsdPer1M: 0.25, outputUsdPer1M: 2, known: true });
    expect(estimateLlmCostMicros(1_000_000, 1_000_000, "OpenAI", "gpt-5-mini")).toBe(2_250_000);
  });
  test("detects routed OpenRouter model IDs", () => {
    expect(getModelRate("OpenRouter", "openai/gpt-5-mini")).toMatchObject({ inputUsdPer1M: 0.25, outputUsdPer1M: 2, known: true });
  });
  test("uses current Anthropic and Google public rates", () => {
    expect(getModelRate("Anthropic", "claude-sonnet-5")).toMatchObject({ inputUsdPer1M: 2, outputUsdPer1M: 10, known: true });
    expect(getModelRate("Google", "gemini-2.5-flash-lite")).toMatchObject({ inputUsdPer1M: 0.10, outputUsdPer1M: 0.40, known: true });
  });
  test("keeps GPT-5 family model rates distinct", () => {
    expect(getModelRate("OpenAI", "gpt-5.4")).toMatchObject({ inputUsdPer1M: 2.5, outputUsdPer1M: 15, known: true });
    expect(getModelRate("OpenAI", "gpt-5-nano")).toMatchObject({ inputUsdPer1M: 0.05, outputUsdPer1M: 0.4, known: true });
  });
  test("uses current documented GPT-5 rate", () => {
    expect(estimateLlmCostMicros(1_000_000, 1_000_000, "OpenAI", "gpt-5")).toBe(11_250_000);
  });
  test("uses environment fallback for an unknown configured model", () => {
    vi.stubEnv("CORTEX_INPUT_USD_PER_1M", "0.4");
    vi.stubEnv("CORTEX_OUTPUT_USD_PER_1M", "3");
    expect(getModelRate("custom", "my-model")).toMatchObject({ inputUsdPer1M: 0.4, outputUsdPer1M: 3, known: false });
    expect(estimateLlmCostMicros(1000, 1000, "custom", "my-model")).toBe(3400);
    vi.unstubAllEnvs();
  });
});