import { applyCors, jsonError, toErrorResponse } from "@/lib/server/http";
import { ADMIN_USERNAME, jsonWithAdminCookie, operatorDashboardPath, signAdminSession, verifyAdminAccessToken } from "@/lib/server/admin-auth";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Backward-compatible endpoint.
 * The old Secret token flow is retired. New clients should use /api/admin/auth/login.
 */
export async function POST(req: Request) {
  try {
    rateLimit(req, "admin-access-exchange", 20, 60_000);
    const body = await req.json().catch(() => ({})) as { token?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!verifyAdminAccessToken(token)) {
      return applyCors(jsonError("لینک مدیریتی معتبر نیست.", 401), req.headers.get("origin"));
    }
    const session = signAdminSession(ADMIN_USERNAME);
    const response = applyCors(
      jsonWithAdminCookie({ ok: true, username: ADMIN_USERNAME, dashboardPath: operatorDashboardPath(token) }, session),
      req.headers.get("origin"),
    );
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
