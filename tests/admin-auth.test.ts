import { describe, expect, it } from "vitest";
import { ADMIN_USERNAME, signAdminSession, verifyAdminAccessToken, verifyAdminSession, verifyAdminUsername, operatorDashboardPath } from "@/lib/server/admin-auth";
import { POST as adminLogin } from "@/app/api/admin/auth/login/route";

describe("admin authentication", () => {
  it("signs and verifies the owner admin session", () => {
    const token = signAdminSession(ADMIN_USERNAME);
    expect(verifyAdminSession(token)).toBe(ADMIN_USERNAME);
  });

  it("accepts only the configured owner username", () => {
    expect(verifyAdminUsername("ehsanam86")).toBe(true);
    expect(verifyAdminUsername("owner")).toBe(false);
  });

  it("logs the owner in with username only", async () => {
    process.env.APP_SECRET_KEY = "test-admin-session-secret-012345678901234567890123";
    const response = await adminLogin(new Request("https://cortex.test/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "ehsanam86" }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("cortex_admin_session=");
    const body = await response.json() as { ok?: boolean; username?: string; dashboardPath?: string };
    expect(body.ok).toBe(true);
    expect(body.username).toBe("ehsanam86");
    expect(body.dashboardPath).toMatch(/^\/ops\/[^/]+\/console$/);
  });

  it("rejects non-owner usernames without requiring a password", async () => {
    const response = await adminLogin(new Request("https://cortex.test/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "owner" }),
    }));
    expect(response.status).toBe(401);
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
