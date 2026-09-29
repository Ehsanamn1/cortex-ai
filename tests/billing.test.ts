import { describe, expect, it } from "vitest";
import {
  DEFAULT_BILLING_PLANS,
  BillingInsufficientCreditsError,
  creditsFromProviderCost,
  catalogCostMicros,
  defaultCreditMultiplierBps,
  BillingOverageDisabledError,
} from "@/lib/server/billing";

describe("Cortex commercial billing", () => {
  it("maps model tiers to deterministic multipliers", () => {
    expect(defaultCreditMultiplierBps("economy")).toBe(200);
    expect(defaultCreditMultiplierBps("balanced")).toBe(200);
    expect(defaultCreditMultiplierBps("premium")).toBe(400);
    expect(defaultCreditMultiplierBps("deep")).toBe(800);
    expect(defaultCreditMultiplierBps("unknown")).toBe(200);
  });

  it("converts provider cost micros into billable credits", () => {
    expect(creditsFromProviderCost(1000, 100)).toBe(1);
    expect(creditsFromProviderCost(1000, 400)).toBe(4);
    expect(creditsFromProviderCost(2501, 200)).toBe(6);
    expect(creditsFromProviderCost(0, 800)).toBe(0);
  });

  it("keeps the commercial plan catalog internally consistent", () => {
    expect(DEFAULT_BILLING_PLANS.map((plan) => plan.key)).toEqual([
      "free",
      "launch",
      "growth",
      "scale",
      "enterprise",
    ]);
    expect(DEFAULT_BILLING_PLANS[0].priceToman).toBe(0);
    expect(DEFAULT_BILLING_PLANS[0]).toMatchObject({ name: "آزمایشی", monthlyCredits: 1000 });
    expect(DEFAULT_BILLING_PLANS[1]).toMatchObject({ name: "Launch", priceToman: 3900000, monthlyCredits: 15000, overageCreditPriceToman: 260 });
    expect(DEFAULT_BILLING_PLANS[2]).toMatchObject({ name: "Growth", priceToman: 12900000, monthlyCredits: 80000, overageCreditPriceToman: 220 });
    expect(DEFAULT_BILLING_PLANS[3]).toMatchObject({ name: "Scale", priceToman: 24900000, monthlyCredits: 180000, overageCreditPriceToman: 190 });
  });

  it("uses persisted catalog rates in micro-USD math", () => {
    expect(catalogCostMicros(1000, 500, 2, 4)).toBe(4000);
    expect(catalogCostMicros(1234.9, 0, 1, 99)).toBe(1234);
    expect(catalogCostMicros(100, 100, 0, 0.5)).toBe(50);
  });

  it("uses HTTP 402 semantics for insufficient credits", () => {
    const error = new BillingInsufficientCreditsError();
    expect(error.status).toBe(402);
    expect(error.code).toBe("insufficient_credits");
  });
  it("uses HTTP 402 semantics when overage is disabled", () => {
    const error = new BillingOverageDisabledError();
    expect(error.status).toBe(402);
    expect(error.code).toBe("overage_disabled");
  });

});
