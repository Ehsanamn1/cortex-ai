import { describe, expect, it } from "vitest";
import {
  CORTEX_UI_CONFIG,
  isCortexPrimaryColor,
  isCortexSecondaryColor,
  normalizeThemeSettings,
} from "@/config/cortex-ui";

describe("Cortex theme contract", () => {
  it("keeps the default identity blue and neutral", () => {
    expect(CORTEX_UI_CONFIG.theme.primary).toBe("#356DFF");
    expect(CORTEX_UI_CONFIG.theme.secondary).toBe("#60708A");
  });

  it("accepts only approved Cortex primary and secondary colors", () => {
    expect(isCortexPrimaryColor("#356dff")).toBe(true);
    expect(isCortexSecondaryColor("#60708a")).toBe(true);
    expect(isCortexPrimaryColor("#B8D85B")).toBe(false);
    expect(isCortexSecondaryColor("#8B5CF6")).toBe(false);
  });

  it("falls back when legacy site colors are stored", () => {
    const theme = normalizeThemeSettings({
      primary: "#B8D85B",
      secondary: "#8B5CF6",
      radius: "0.75",
    });
    expect(theme.primary).toBe(CORTEX_UI_CONFIG.theme.primary);
    expect(theme.secondary).toBe(CORTEX_UI_CONFIG.theme.secondary);
  });
});
