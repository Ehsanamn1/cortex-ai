import crypto from "node:crypto";
import { randomBytes } from "./random";
import { db } from "@/lib/db";
import type { User, WorkspaceMember } from "@/generated/prisma/client";

const COOKIE_NAME = "cortex_session";

function encodeBuffer(value: Buffer, encoding: "hex"): string {
  return (value as unknown as { toString(encoding: "hex"): string }).toString(encoding);
}
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/* ---------------- password hashing ---------------- */

let pgcryptoReady = false;

async function ensurePgcrypto(): Promise<void> {
  if (pgcryptoReady) return;
  await db.$executeRaw`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  pgcryptoReady = true;
}

/**
 * New passwords are hashed in PostgreSQL with pgcrypto instead of consuming
 * Cloudflare Worker CPU. Existing password formats remain supported below.
 */
export async function hashPasswordWithDb(password: string): Promise<string> {
  await ensurePgcrypto();
  const rows = await db.$queryRaw<Array<{ hash: string }>>`
    SELECT crypt(encode(digest(${password}, 'sha256'), 'hex'), gen_salt('bf', 12)) AS hash
  `;
  const hash = rows[0]?.hash;
  if (!hash) throw new Error("Password hashing failed.");
  return hash;
}

export async function verifyPasswordWithDb(password: string, storedHash: string): Promise<boolean> {
  await ensurePgcrypto();
  const rows = await db.$queryRaw<Array<{ ok: boolean }>>`
    SELECT stored_hash = crypt(encode(digest(${password}, 'sha256'), 'hex'), stored_hash) AS ok
    FROM (SELECT ${storedHash}::text AS stored_hash) AS candidate
  `;
  return rows[0]?.ok === true;
}

async function verifyLegacyScryptPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, saltHex, hashHex] = stored.split(":");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex);
    const scrypt = (crypto as unknown as {
      scrypt(password: string, salt: Buffer, keylen: number, callback: (error: Error | null, derivedKey: Buffer) => void): void;
    }).scrypt;
    return await new Promise<boolean>((resolve) => {
      scrypt(password, salt, expected.length, (error, derivedKey) => {
        if (error) return resolve(false);
        resolve(expected.length === derivedKey.length && crypto.timingSafeEqual(expected, derivedKey));
      });
    });
  } catch {
    return false;
  }
}

async function verifyPbkdf2Password(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, iterationsRaw, saltRaw, hashRaw] = stored.split(":");
    if (scheme !== "pbkdf2-sha256-v1" || !iterationsRaw || !saltRaw || !hashRaw) return false;
    const iterations = Number(iterationsRaw);
    if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) return false;
    const saltBytes = Buffer.from(saltRaw, "base64url");
    const salt = new ArrayBuffer(saltBytes.byteLength);
    new Uint8Array(salt).set(saltBytes);
    const expected = Buffer.from(hashRaw, "base64url");
    const keyMaterial = await globalThis.crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const derived = await globalThis.crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, expected.length * 8);
    const actual = Buffer.from(new Uint8Array(derived));
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) return verifyPasswordWithDb(password, stored);
  if (stored.startsWith("pbkdf2-sha256-v1:")) return verifyPbkdf2Password(password, stored);
  if (stored.startsWith("scrypt:")) return verifyLegacyScryptPassword(password, stored);
  return false;
}

/* ---------------- session token (compact JWT, HS256) ---------------- */

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

class SessionConfigError extends Error {
  status = 503;
  constructor() {
    super("کلید امن نشست برنامه در محیط تولید تنظیم نشده است.");
    this.name = "SessionConfigError";
  }
}

function secret(): string {
  const s = process.env.APP_SECRET_KEY;
  if (s && s.length >= 32) return s;
  if ((process.env.NODE_ENV === "production" || process.env.APP_ENV === "production")) throw new SessionConfigError();
  const g = globalThis as { __cortexEphemeralSecret?: string };
  if (!g.__cortexEphemeralSecret) {
    g.__cortexEphemeralSecret = Buffer.from(randomBytes(32)).toString("hex");
  }
  return g.__cortexEphemeralSecret!;
}

export function signSessionToken(userId: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({ sub: userId, iat: now, exp: now + SESSION_TTL_SECONDS })
  );
  const sig = crypto
    .createHmac("sha256", secret())
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  try {
    const [header, payload, sig] = token.split(".");
    if (!header || !payload || !sig) return null;
    const expected = crypto
      .createHmac("sha256", secret())
      .update(`${header}.${payload}`)
      .digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
      exp?: number;
    };
    if (!data.sub || !data.exp) return null;
    if (Date.now() / 1000 > data.exp) return null;
    return data.sub;
  } catch (error) {
    if (error instanceof SessionConfigError) throw error;
    return null;
  }
}

/* ---------------- session context ---------------- */

export interface SessionContext {
  user: User;
  memberships: (WorkspaceMember & { workspace: { id: string; name: string } })[];
}

/** Reads + verifies the session cookie and loads the user with memberships. */
export async function getSession(req: Request): Promise<SessionContext | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        return idx === -1
          ? [part, ""]
          : [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { memberships: { include: { workspace: { select: { id: true, name: true } } } } },
  });
  if (!user) return null;
  return { user, memberships: user.memberships };
}

export class UnauthorizedError extends Error {
  status = 401;
  constructor() {
    super("برای انجام این عملیات باید وارد حساب خود شوید.");
  }
}

export async function requireSession(req: Request): Promise<SessionContext> {
  const session = await getSession(req);
  if (!session) throw new UnauthorizedError();
  return session;
}

/** Server-side workspace access check. Client-supplied IDs are never trusted. */
export function assertWorkspaceAccess(
  session: SessionContext,
  workspaceId: string
): WorkspaceMember {
  const membership = session.memberships.find((m) => m.workspaceId === workspaceId);
  if (!membership) {
    const err = new Error("دسترسی به این فضای کاری ندارید.");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return membership;
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookieHeader(): string {
  const secure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
  return COOKIE_NAME + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" + (secure ? "; Secure" : "");
}

/* ---------------- serialization helpers ---------------- */

export function publicUser(user: User) {
  return { id: user.id, name: user.name, email: user.email };
}

export function publicWorkspaces(session: SessionContext) {
  return session.memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    role: m.role,
    createdAt: m.createdAt.toISOString(),
  }));
}
