import { applyCors, jsonError, toErrorResponse } from "@/lib/server/http";
import {
  ADMIN_USERNAME,
  jsonWithAdminCookie,
  operatorDashboardPathFromAdminSecret,
  signAdminSession,
  verifyAdminPassword,
  verifyAdminUsername,
} from "@/lib/server/admin-auth";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    rateLimit(req, "admin-password-login", 10, 60_000);

    const origin = req.headers.get("origin");
    if (origin) {
      const requestOrigin = new URL(req.url).origin;
      if (origin !== requestOrigin) {
        return applyCors(jsonError("درخواست نامعتبر است.", 403), origin);
      }
    }

    const body = await req.json().catch(() => ({})) as { username?: unknown; password?: unknown };
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!verifyAdminUsername(username) || !verifyAdminPassword(password)) {
      return applyCors(jsonError("نام کاربری یا رمز عبور نادرست است.", 401), origin);
    }

    const session = signAdminSession(ADMIN_USERNAME);
    const response = applyCors(
      jsonWithAdminCookie({
        ok: true,
        username: ADMIN_USERNAME,
        dashboardPath: operatorDashboardPathFromAdminSecret(),
      }, session),
      origin,
    );
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
