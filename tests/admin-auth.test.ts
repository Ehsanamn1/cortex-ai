import { describe, expect, it } from "vitest";
import { ADMIN_USERNAME, signAdminSession, verifyAdminAccessToken, verifyAdminSession, verifyAdminUsername, operatorDashboardPath } from "@/lib/server/admin-auth";

describe("admin authentication", () => {
  it("signs and verifies the owner admin session", () => {
    const token = signAdminSession(ADMIN_USERNAME);
    expect(verifyAdminSession(token)).toBe(ADMIN_USERNAME);
  });

  it("accepts only the configured owner username", () => {
    expect(verifyAdminUsername("ehsanam86")).toBe(true);
    expect(verifyAdminUsername("owner")).toBe(false);
  });

  it("derives a non-obvious operator dashboard path from the access token", () => {
    process.env.CORTEX_ADMIN_ACCESS_TOKEN = "a".repeat(32);
    expect(verifyAdminAccessToken("a".repeat(32))).toBe(true);
    expect(verifyAdminAccessToken("b".repeat(32))).toBe(false);
    expect(operatorDashboardPath("a".repeat(32))).toMatch(/^\/ops\/[^/]+\/console$/);
  });

  it("rejects malformed access sessions", () => {
    expect(verifyAdminSession("not-a-session")).toBeNull();
  });
});
