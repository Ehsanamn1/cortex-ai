import crypto from "node:crypto";
import { randomBytes } from "./random";

export const GOOGLE_STATE_COOKIE = "cortex_google_state";
const STATE_TTL_SECONDS = 10 * 60;

function secret(): string {
  const value = process.env.APP_SECRET_KEY;
  if (!value || value.length < 32) throw Object.assign(new Error("کلید امن برنامه برای ورود با Google تنظیم نشده است."), { status: 503 });
  return value;
}

export function googleClientId(): string {
  const value = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!value) throw Object.assign(new Error("GOOGLE_CLIENT_ID تنظیم نشده است."), { status: 503 });
  return value;
}

export function googleClientSecret(): string {
  const value = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!value) throw Object.assign(new Error("GOOGLE_CLIENT_SECRET تنظیم نشده است."), { status: 503 });
  return value;
}

export function googleRedirectUri(request: Request): string {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) return configured;
  const url = new URL(request.url);
  return url.origin + "/api/auth/google/callback";
}

function signState(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createGoogleState() {
  const nonce = Buffer.from(randomBytes(32)).toString("hex");
  return nonce + "." + signState(nonce);
}

export function verifyGoogleState(value: string | null) {
  if (!value) return false;
  const [nonce, signature] = value.split(".");
  if (!nonce || !signature) return false;
  const expected = signState(nonce);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function googleStateCookie(state: string) {
  const secure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
  return GOOGLE_STATE_COOKIE + "=" + encodeURIComponent(state) + "; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=" + STATE_TTL_SECONDS + (secure ? "; Secure" : "");
}

export function clearGoogleStateCookie() {
  const secure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
  return GOOGLE_STATE_COOKIE + "=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0" + (secure ? "; Secure" : "");
}

export function readGoogleState(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const part = cookieHeader.split(";").map((v) => v.trim()).find((v) => v.startsWith(GOOGLE_STATE_COOKIE + "="));
  return part ? decodeURIComponent(part.slice(GOOGLE_STATE_COOKIE.length + 1)) : null;
}
