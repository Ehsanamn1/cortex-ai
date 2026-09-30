import { applyCors, jsonError, toErrorResponse } from "@/lib/server/http";
import { ADMIN_USERNAME, jsonWithAdminCookie, signAdminSession, verifyAdminUsername } from "@/lib/server/admin-auth";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    rateLimit(req, "admin-username-login", 20, 60_000);
    const body = await req.json().catch(() => ({})) as { username?: unknown };
    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (!verifyAdminUsername(username)) {
      return applyCors(jsonError("نام کاربری مدیریت معتبر نیست.", 401), req.headers.get("origin"));
    }

    const session = signAdminSession(ADMIN_USERNAME);
    const response = applyCors(
      jsonWithAdminCookie({ ok: true, username: ADMIN_USERNAME }, session),
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
