import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { hashPasswordWithDb } from "@/lib/server/auth";
import { hashPasswordResetToken } from "@/lib/server/email";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    rateLimit(req, "reset-password", 8, 15 * 60_000);
    const body = await readJson<{ token?: unknown; password?: unknown }>(req);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!token) return applyCors(jsonError("لینک بازنشانی معتبر نیست.", 400), req.headers.get("origin"));
    if (password.length < 8 || password.length > 128) {
      return applyCors(jsonError("رمز عبور باید بین ۸ تا ۱۲۸ کاراکتر باشد.", 400), req.headers.get("origin"));
    }

    const tokenHash = hashPasswordResetToken(token);
    const reset = await db.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      return applyCors(jsonError("این لینک بازنشانی منقضی یا قبلاً استفاده شده است.", 400), req.headers.get("origin"));
    }

    const passwordHash = await hashPasswordWithDb(password);
    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await tx.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: now } });
      await tx.passwordResetToken.deleteMany({ where: { userId: reset.userId, id: { not: reset.id } } });
    });

    return applyCors(jsonOk({ ok: true, message: "رمز عبور با موفقیت تغییر کرد. حالا می‌توانید وارد شوید." }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
