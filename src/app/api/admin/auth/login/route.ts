import { NextResponse } from "next/server";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { adminCredentials, signAdminSession, jsonWithAdminCookie } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
      return applyCors(jsonError("ورود با نام کاربری و رمز عبور برای پیشخوان خصوصی فعال نیست.", 404), req.headers.get("origin"));
    }
    rateLimit(req, "admin-login", 10, 60_000);
    const body = await readJson<{ username?: unknown; password?: unknown }>(req);
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const expected = adminCredentials();

    if (username !== expected.username || password !== expected.password) {
      return applyCors(jsonError("نام کاربری یا رمز عبور مدیر نادرست است.", 401), req.headers.get("origin"));
    }

    return applyCors(
      jsonWithAdminCookie({ ok: true, username }, signAdminSession(username)),
      req.headers.get("origin")
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
