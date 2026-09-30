import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession, hashPasswordWithDb, verifyPassword } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await requireSession(req);
    rateLimit(req, "change-password", 8, 60_000);
    const body = await readJson<{ currentPassword?: unknown; newPassword?: unknown }>(req);
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (newPassword.length < 8 || newPassword.length > 128) {
      return applyCors(jsonError("رمز جدید باید بین ۸ تا ۱۲۸ کاراکتر باشد.", 400), req.headers.get("origin"));
    }
    const valid = await verifyPassword(currentPassword, session.user.passwordHash);
    if (!valid) return applyCors(jsonError("رمز فعلی نادرست است.", 401), req.headers.get("origin"));
    const passwordHash = await hashPasswordWithDb(newPassword);
    await db.user.update({ where: { id: session.user.id }, data: { passwordHash } });
    return applyCors(jsonOk({ ok: true }), req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}
