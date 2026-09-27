import { describe, expect, test, vi } from "vitest";
import { estimateLlmCostMicros, getModelRate } from "@/lib/server/pricing";

describe("Cortex pricing estimates", () => {
  test("uses current documented GPT-5 mini rate", () => {
    expect(getModelRate("OpenAI", "gpt-5-mini")).toMatchObject({ inputUsdPer1M: 0.25, outputUsdPer1M: 2, known: true });
    expect(estimateLlmCostMicros(1_000_000, 1_000_000, "OpenAI", "gpt-5-mini")).toBe(2_250_000);
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