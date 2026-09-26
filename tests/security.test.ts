import { describe, expect, test } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/server/secrets";
import { normalizeTelegramPhone } from "@/lib/telegram/phone";
import { isPrivateIp, validateUrl, UnsafeUrlError } from "@/lib/knowledge/extract";

describe("security primitives", () => {
  test("encrypts and decrypts secrets with authenticated encryption", () => {
    process.env.APP_SECRET_KEY = "test-secret-key-012345678901234567890123456789";
    const plaintext = "telegram-bot-token-123";
    const encrypted = encryptSecret(plaintext);

    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  test("normalizes Persian/Arabic Telegram phone digits", () => {
    expect(normalizeTelegramPhone("۰۹۱۲-۱۲۳-۴۵۶۷")).toBe("+989121234567");
    expect(normalizeTelegramPhone("0098 912 123 4567")).toBe("+989121234567");
  });

  test("rejects private or link-local addresses", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.0.0.8")).toBe(true);
    expect(isPrivateIp("192.168.1.10")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(() => validateUrl("http://127.0.0.1/admin")).toThrow(UnsafeUrlError);
    expect(() => validateUrl("http://localhost:3000")).toThrow(UnsafeUrlError);
    expect(validateUrl("https://example.com/docs").hostname).toBe("example.com");
  });
});
