import { describe, expect, test, vi } from "vitest";
import { providerCostToCredits } from "@/lib/server/billing";

describe("Cortex credit economics", () => {
  test("rounds provider cost up to whole credits", () => {
    expect(providerCostToCredits(0)).toBe(1n);
    expect(providerCostToCredits(1000)).toBe(1n);
    expect(providerCostToCredits(1001)).toBe(2n);
  });

  test("applies model multiplier after base cost conversion", () => {
    expect(providerCostToCredits(1000, 2000)).toBe(2n);
    expect(providerCostToCredits(1500, 4000)).toBe(8n);
  });

  test("uses configurable credit USD micros", () => {
    vi.stubEnv("CORTEX_CREDIT_USD_MICROS", "2000");
    vi.resetModules();
    return import("@/lib/server/billing").then(({ providerCostToCredits: configured }) => {
      expect(configured(2000, 1000)).toBe(1n);
      expect(configured(2001, 1000)).toBe(2n);
    }).finally(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });
  });
});
