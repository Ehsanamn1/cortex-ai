import { afterEach, describe, expect, it } from "vitest";
import {
  adminCredentials,
  signAdminSession,
  verifyAdminSession,
} from "@/lib/server/admin-auth";

const originalUser = process.env.CORTEX_ADMIN_USERNAME;
const originalPass = process.env.CORTEX_ADMIN_PASSWORD;

afterEach(() => {
  process.env.CORTEX_ADMIN_USERNAME = originalUser;
  process.env.CORTEX_ADMIN_PASSWORD = originalPass;
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
