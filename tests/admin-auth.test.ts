import { afterEach, describe, expect, it } from "vitest";
import {
  adminCredentials,
  signAdminSession,
  verifyAdminSession,
  verifyAdminEntryToken,
} from "@/lib/server/admin-auth";

const originalUser = process.env.CORTEX_ADMIN_USERNAME;
const originalPass = process.env.CORTEX_ADMIN_PASSWORD;
const originalEntry = process.env.CORTEX_ADMIN_ENTRY_TOKEN;

afterEach(() => {
  process.env.CORTEX_ADMIN_USERNAME = originalUser;
  process.env.CORTEX_ADMIN_PASSWORD = originalPass;
  process.env.CORTEX_ADMIN_ENTRY_TOKEN = originalEntry;
});

describe("admin authentication", () => {
  it("uses the requested staging credentials when explicit env values are absent", () => {
    delete process.env.CORTEX_ADMIN_USERNAME;
    delete process.env.CORTEX_ADMIN_PASSWORD;

    const credentials = adminCredentials();
    expect(credentials.username).toBe("ehsan86");
    expect(credentials.password).toBe("ehsanam86");
  });

  it("signs and verifies the admin session", () => {
    const token = signAdminSession("ehsan86");
    expect(verifyAdminSession(token)).toBe("ehsan86");
  });
});


describe("private admin entry token", () => {
  it("accepts only the configured high-entropy token", () => {
    process.env.CORTEX_ADMIN_ENTRY_TOKEN = "a".repeat(64);
    expect(verifyAdminEntryToken("a".repeat(64))).toBe(true);
    expect(verifyAdminEntryToken("b".repeat(64))).toBe(false);
  });

  it("rejects short or missing entry tokens outside production", () => {
    delete process.env.CORTEX_ADMIN_ENTRY_TOKEN;
    expect(verifyAdminEntryToken("a".repeat(64))).toBe(false);
  });
});
