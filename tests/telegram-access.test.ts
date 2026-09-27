import { describe, expect, test } from "vitest";
import { buildTelegramInviteLink, createTelegramInviteToken, hashTelegramInviteToken, parseTelegramStartToken } from "@/lib/telegram/access";

describe("Telegram managed access", () => {
  test("creates a valid one-time start payload", () => {
    const token = createTelegramInviteToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(hashTelegramInviteToken(token)).not.toContain(token);
    expect(parseTelegramStartToken("/start " + token)).toBe(token);
    expect(buildTelegramInviteLink("@my_cortex_bot", token)).toContain("https://t.me/my_cortex_bot?start=");
  });
  test("rejects malformed start payloads", () => {
    expect(parseTelegramStartToken("/start")).toBeNull();
    expect(parseTelegramStartToken("/start short")).toBeNull();
    expect(parseTelegramStartToken("سلام")).toBeNull();
  });
});