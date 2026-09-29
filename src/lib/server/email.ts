import { createHash, randomBytes } from "node:crypto";

const RESET_TTL_MS = 30 * 60 * 1000;

function trimEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function createPasswordResetToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash, expiresAt: new Date(Date.now() + RESET_TTL_MS) };
}

export function hashPasswordResetToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function appBaseUrl(): string {
  return (trimEnv("APP_PUBLIC_URL") || trimEnv("CORTEX_CUSTOMER_APP_URL") || "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return char;
    }
  });
}

function emailFrom(): string {
  return trimEnv("CORTEX_EMAIL_FROM") || "Cortex AI <no-reply@cortex-ai.local>";
}

export async function sendPasswordResetEmail(input: { email: string; name?: string | null; token: string }): Promise<{ delivered: boolean; resetUrl: string }> {
  const resetUrl = appBaseUrl() + "/reset-password?token=" + encodeURIComponent(input.token);
  const apiKey = trimEnv("CORTEX_RESEND_API_KEY");

  if (!apiKey) {
    if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
      throw Object.assign(new Error("سرویس ارسال ایمیل Cortex پیکربندی نشده است."), { status: 503, code: "email_provider_unavailable" });
    }
    return { delivered: false, resetUrl };
  }

  const greeting = input.name?.trim() ? "سلام " + escapeHtml(input.name.trim()) + " عزیز،" : "سلام،";
  const html = [
    '<!doctype html><html lang="fa" dir="rtl"><body style="margin:0;background:#f5f7fb;font-family:Tahoma,Arial,sans-serif;color:#172033">',
    '<div style="max-width:620px;margin:32px auto;padding:0 16px">',
    '<div style="background:#0b1020;border-radius:24px 24px 0 0;padding:24px;color:#fff"><div style="font-size:12px;letter-spacing:.16em;font-weight:700;color:#8fb3ff">CORTEX AI</div><div style="font-size:26px;font-weight:800;margin-top:8px">بازنشانی رمز عبور</div></div>',
    '<div style="background:#fff;border:1px solid #e7ebf2;border-top:0;border-radius:0 0 24px 24px;padding:28px">',
    '<p style="font-size:15px;line-height:2;margin-top:0">' + greeting + '</p>',
    '<p style="font-size:14px;line-height:2;color:#667085">برای تعیین رمز عبور جدید، روی دکمه زیر بزن. این لینک فقط ۳۰ دقیقه معتبر است و تنها یک‌بار قابل استفاده خواهد بود.</p>',
    '<p style="margin:28px 0"><a href="' + resetUrl + '" style="display:inline-block;background:#4880ff;color:#fff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:800">تعیین رمز عبور جدید</a></p>',
    '<p style="font-size:12px;line-height:1.9;color:#98a2b3;word-break:break-all">اگر دکمه باز نشد، این لینک را در مرورگر باز کن:<br>' + resetUrl + '</p>',
    '<p style="font-size:12px;line-height:1.9;color:#98a2b3">اگر این درخواست از طرف شما نبوده، این ایمیل را نادیده بگیر.</p>',
    '</div></div></body></html>',
  ].join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: emailFrom(),
      to: [input.email],
      subject: "بازنشانی رمز عبور Cortex AI",
      html,
    }),
  });

  if (!response.ok) {
    await response.text().catch(() => "");
    throw Object.assign(new Error("ارسال ایمیل بازنشانی انجام نشد."), { status: 502, code: "email_delivery_failed" });
  }

  return { delivered: true, resetUrl };
}
