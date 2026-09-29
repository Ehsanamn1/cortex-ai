import { describe, expect, it } from "vitest";
import { normalizeTelegramCommands, profileUpdateData } from "@/lib/telegram/profile";

describe("Telegram profile command hardening", () => {
  it("normalizes Telegram commands, removes slash and duplicates", () => {
    const commands = normalizeTelegramCommands([
      { command: "/Start", description: "شروع" },
      { command: "start", description: "تکراری" },
      { command: "new_chat", description: "گفتگوی جدید" },
      { command: "bad command", description: "نباید پذیرفته شود" },
      { command: "123", description: "عدد" },
    ]);

    expect(commands).toEqual([
      { command: "start", description: "شروع" },
      { command: "new_chat", description: "گفتگوی جدید" },
      { command: "123", description: "عدد" },
    ]);
  });

  it("rejects a commands payload when every supplied command is invalid", () => {
    expect(() =>
      profileUpdateData({
        commands: [{ command: "bad command", description: "invalid" }],
      }),
    ).toThrow(/فرمت Command نامعتبر/);
  });

  it("keeps the built-in command set when an empty command list is saved", () => {
    const update = profileUpdateData({ commands: [] });
    expect(String(update.commandsJson)).toContain('"start"');
    expect(String(update.commandsJson)).toContain('"help"');
  });
});
