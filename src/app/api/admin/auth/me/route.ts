import { applyCors, jsonError, jsonOk, toErrorResponse } from "@/lib/server/http";
import { readAdminUsername } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const username = readAdminUsername(req);
    if (!username) return applyCors(jsonError("وارد نشده‌اید.", 401), req.headers.get("origin"));
    return applyCors(jsonOk({ ok: true, username }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
