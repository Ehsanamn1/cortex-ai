import { applyCors, jsonError } from "@/lib/server/http";
import { adminCookie, adminPrincipal, signAdminSession, verifyAdminEntryToken } from "@/lib/server/admin-auth";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    rateLimit(req, "admin-entry", 8, 60_000);
    const body = await req.json().catch(() => ({})) as { token?: unknown };
    const token = typeof body.token === "string" ? body.token : "";
    if (!verifyAdminEntryToken(token)) {
      return applyCors(jsonError("لینک خصوصی مدیریت معتبر نیست یا منقضی شده است.", 401), req.headers.get("origin"));
    }
    const response = new Response(JSON.stringify({ ok: true, principal: adminPrincipal() }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
      },
    });
    response.headers.set("Set-Cookie", adminCookie(signAdminSession(adminPrincipal())));
    return applyCors(response, req.headers.get("origin"));
  } catch (error) {
    const status = Number((error as { status?: unknown })?.status);
    const message = error instanceof Error ? error.message : "دسترسی مدیریت برقرار نشد.";
    return applyCors(jsonError(message, Number.isInteger(status) && status > 0 ? status : 503), req.headers.get("origin"));
  }
}
