import { describe, expect, it } from "vitest";
import { ADMIN_USERNAME, signAdminSession, verifyAdminSession, verifyAdminUsername } from "@/lib/server/admin-auth";

describe("admin authentication", () => {
  it("signs and verifies the owner admin session", () => {
    const token = signAdminSession(ADMIN_USERNAME);
    expect(verifyAdminSession(token)).toBe(ADMIN_USERNAME);
  });

  it("accepts only the configured owner username", () => {
    expect(verifyAdminUsername("ehsanam86")).toBe(true);
    expect(verifyAdminUsername("owner")).toBe(false);
  });

  it("rejects malformed access sessions", () => {
    expect(verifyAdminSession("not-a-session")).toBeNull();
  });
});
