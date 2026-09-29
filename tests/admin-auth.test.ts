import { afterEach, describe, expect, it } from "vitest";
import {
  signAdminSession,
  verifyAdminAccessToken,
  verifyAdminSession,
} from "@/lib/server/admin-auth";

const originalSecret = process.env.CORTEX_ADMIN_SESSION_SECRET;
const originalAccessToken = process.env.CORTEX_ADMIN_ACCESS_TOKEN;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CORTEX_ADMIN_SESSION_SECRET;
  else process.env.CORTEX_ADMIN_SESSION_SECRET = originalSecret;
  if (originalAccessToken === undefined) delete process.env.CORTEX_ADMIN_ACCESS_TOKEN;
  else process.env.CORTEX_ADMIN_ACCESS_TOKEN = originalAccessToken;
});

describe("private system desk authentication", () => {
  it("signs and verifies the server-side admin session", () => {
    process.env.CORTEX_ADMIN_SESSION_SECRET = "ci-admin-secret-change-me-0123456789-abcdef";
    const token = signAdminSession("owner");
    expect(verifyAdminSession(token)).toBe("owner");
    expect(verifyAdminSession(token.slice(0, -1) + "x")).toBeNull();
  });

  it("accepts only the configured long-lived access token", () => {
    process.env.CORTEX_ADMIN_SESSION_SECRET = "ci-admin-secret-change-me-0123456789-abcdef";
    process.env.CORTEX_ADMIN_ACCESS_TOKEN = "ci-owner-private-access-token-abcdefghijklmnopqrstuvwxyz";
    expect(verifyAdminAccessToken(process.env.CORTEX_ADMIN_ACCESS_TOKEN)).toBe(true);
    expect(verifyAdminAccessToken("ci-owner-private-access-token-wrong")).toBe(false);
    expect(verifyAdminAccessToken("")).toBe(false);
  });
});
