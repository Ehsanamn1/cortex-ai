import crypto from "node:crypto";
import { randomBytes } from "./random";
import { NextResponse } from "next/server";

const COOKIE_NAME = "cortex_admin_session";
const TTL_SECONDS = 60 * 60 * 12;
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "CortexAdmin-ChangeMe-2026!";

function secret(): string {
  const configured = process.env.CORTEX_ADMIN_SESSION_SECRET || process.env.APP_SECRET_KEY;
  if (configured && configured.length >= 16) return configured;
  const g = globalThis as { __cortexAdminSecret?: string };
  if (!g.__cortexAdminSecret) g.__cortexAdminSecret = Buffer.from(randomBytes(32)).toString("hex");
  return g.__cortexAdminSecret as string;
}

export function adminCredentials() {
  return {
    username: process.env.CORTEX_ADMIN_USERNAME || DEFAULT_USERNAME,
    password: process.env.CORTEX_ADMIN_PASSWORD || DEFAULT_PASSWORD,
  };
}

function encode(value: string) { return Buffer.from(value).toString("base64url"); }

export function signAdminSession(username: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = encode(JSON.stringify({ sub: username, iat: now, exp: now + TTL_SECONDS }));
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return payload + "." + sig;
}

export function verifyAdminSession(token: string | null): string | null {
  if (!token) return null;
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; exp?: number };
    if (!body.sub || !body.exp || Date.now() / 1000 > body.exp) return null;
    return body.sub;
  } catch {
    return null;
  }
}

export function adminCookie(token: string) {
  const secure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
  return COOKIE_NAME + "=" + encodeURIComponent(token) + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + TTL_SECONDS + (secure ? "; Secure" : "");
}

export function clearAdminCookie() {
  return COOKIE_NAME + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

export function readAdminUsername(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const part = cookie.split(";").map((x) => x.trim()).find((x) => x.startsWith(COOKIE_NAME + "="));
  if (!part) return null;
  return verifyAdminSession(decodeURIComponent(part.slice(COOKIE_NAME.length + 1)));
}

export function requireAdmin(req: Request) {
  const username = readAdminUsername(req);
  if (!username) {
    const error = new Error("نشست مدیریت معتبر نیست.");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
  return username;
}

export function jsonWithAdminCookie(body: unknown, token: string) {
  const response = NextResponse.json(body);
  response.headers.set("Set-Cookie", adminCookie(token));
  return response;
}
