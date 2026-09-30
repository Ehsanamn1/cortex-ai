import { describe, expect, it } from "vitest";
import { CORTEX_UI_CONFIG } from "@/config/cortex-ui";
import { normalizeTelegramCommands, TELEGRAM_PROFILE_DEFAULTS } from "@/lib/telegram/profile";

describe("Cortex live navigation and Telegram contracts", () => {
  it("does not expose unfinished workflow navigation", () => {
    expect(CORTEX_UI_CONFIG.navigation.some((item) => item.view === "workflows")).toBe(false);
    expect(CORTEX_UI_CONFIG.navigation.some((item) => item.view === "admin")).toBe(false);
  });

  it("supports configurable Telegram command options", () => {
    const commands = normalizeTelegramCommands([
      { command: "/pricing", description: "قیمت‌ها" },
      { command: "support", description: "پشتیبانی" },
      { command: "bad command", description: "رد شود" },
      { command: "pricing", description: "تکراری" },
    ]);
    expect(commands).toEqual([
      { command: "pricing", description: "قیمت‌ها" },
      { command: "support", description: "پشتیبانی" },
    ]);
    expect(TELEGRAM_PROFILE_DEFAULTS.showThinking).toBe(true);
  });
});
