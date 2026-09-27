import { describe, expect, test } from "vitest";
import { BUSINESS_ONBOARDING_QUESTIONS, parseOnboardingResult } from "@/lib/agents/onboarding";

describe("Business onboarding", () => {
  test("ships exactly 30 owner questions across key business categories", () => {
    expect(BUSINESS_ONBOARDING_QUESTIONS).toHaveLength(30);
    expect(new Set(BUSINESS_ONBOARDING_QUESTIONS.map(q => q.id)).size).toBe(30);
    expect(BUSINESS_ONBOARDING_QUESTIONS.map(q => q.category)).toEqual(expect.arrayContaining(["فروش", "قوانین", "پشتیبانی", "ارجاع"]));
  });
  test("parses JSON from a model response and rejects empty synthesis", () => {
    const raw = "```json\n{"businessSummary":"فروشگاه قطعات","services":["فروش قطعات"],"faq":[{"question":"ارسال؟","answer":"تهران"}]}\n```";
    const result = parseOnboardingResult(raw);
    expect(result.businessSummary).toBe("فروشگاه قطعات");
    expect(result.services).toEqual(["فروش قطعات"]);
    expect(result.faq[0]?.answer).toBe("تهران");
    expect(() => parseOnboardingResult("no json here")).toThrow();
  });
});