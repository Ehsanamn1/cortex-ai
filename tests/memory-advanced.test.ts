import { describe, expect, test } from "vitest";
import { extractExplicitMemories } from "@/lib/runtime/memory";

describe("advanced explicit memory extraction", () => {
  test("extracts safe explicit profile facts and preferences", () => {
    const result = extractExplicitMemories("اسم من احسان است. شغلم طراح محصول است و ترجیح میدم پاسخ‌ها کوتاه و مستقیم باشند.");
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "profile.name", value: "احسان است" }),
      expect.objectContaining({ key: "profile.role", value: "طراح محصول است و ترجیح میدم پاسخ‌ها کوتاه و مستقیم باشند" }),
    ]));
  });

  test("does not promote phone-like data into memory", () => {
    const result = extractExplicitMemories("شماره من 09121234567 است.");
    expect(result).toHaveLength(0);
  });

  test("extracts English preferences too", () => {
    const result = extractExplicitMemories("My name is Alex. I love sci-fi stories.");
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "profile.name" }),
      expect.objectContaining({ key: "preference.topic" }),
    ]));
  });
});
