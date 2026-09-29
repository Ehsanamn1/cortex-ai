import { applyCors, jsonError, jsonWithAdminCookie, toErrorResponse } from "@/lib/server/http";
import { jsonWithAdminCookie as setAdminCookie, signAdminSession, verifyAdminAccessToken } from "@/lib/server/admin-auth";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    rateLimit(req, "admin-access-exchange", 20, 60_000);
    const body = await req.json().catch(() => ({})) as { token?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!verifyAdminAccessToken(token)) {
      return applyCors(jsonError("لینک مدیریتی معتبر نیست یا منقضی شده است.", 401), req.headers.get("origin"));
    }
    const session = signAdminSession("owner");
    return applyCors(setAdminCookie({ ok: true, username: "owner" }, session), req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}
