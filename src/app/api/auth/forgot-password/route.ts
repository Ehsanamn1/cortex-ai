import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { createPasswordResetToken, sendPasswordResetEmail } from "@/lib/server/email";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const GENERIC = "اگر حسابی با این ایمیل وجود داشته باشد، لینک بازنشانی رمز برای شما ارسال می‌شود.";

export async function POST(req: Request) {
  try {
    rateLimit(req, "forgot-password", 5, 15 * 60_000);
    const body = await readJson<{ email?: unknown }>(req);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return applyCors(jsonError("یک ایمیل معتبر وارد کنید.", 400), req.headers.get("origin"));
    }

    const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
    if (!user) {
      return applyCors(jsonOk({ ok: true, message: GENERIC }), req.headers.get("origin"));
    }

    await db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    const token = await createPasswordResetToken();
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: token.hash, expiresAt: token.expiresAt },
    });

    const delivery = await sendPasswordResetEmail({ email: user.email, name: user.name, token: token.raw });
    return applyCors(
      jsonOk({
        ok: true,
        message: delivery.delivered ? GENERIC : "ایمیل پیکربندی نشده؛ در محیط توسعه می‌توان از لینک تست استفاده کرد.",
        ...(process.env.NODE_ENV !== "production" && process.env.APP_ENV !== "production" ? { devResetUrl: delivery.resetUrl } : {}),
      }),
      req.headers.get("origin"),
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
