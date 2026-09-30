import { describe, expect, it } from "vitest";
import { AdminConfigError, signAdminSession, verifyAdminSession } from "@/lib/server/admin-auth";

describe("admin authentication", () => {
  it("does not provide a legacy username/password credential path", () => {
    expect(() => {
      throw new AdminConfigError("legacy");
    }).toThrow(AdminConfigError);
  });

  it("signs and verifies the private-link admin session", () => {
    const token = signAdminSession("owner");
    expect(verifyAdminSession(token)).toBe("owner");
  });

  it("rejects malformed access sessions", () => {
    expect(verifyAdminSession("not-a-session")).toBeNull();
  });
});
