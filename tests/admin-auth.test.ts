import { describe, expect, it } from "vitest";
import { signAdminSession, verifyAdminSession } from "@/lib/server/admin-auth";

describe("admin authentication", () => {
  it("signs and verifies the private-link admin session", () => {
    const token = signAdminSession("owner");
    expect(verifyAdminSession(token)).toBe("owner");
  });

  it("rejects malformed access sessions", () => {
    expect(verifyAdminSession("not-a-session")).toBeNull();
  });
});
