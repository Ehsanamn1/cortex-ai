import crypto from "crypto";
import { db } from "@/lib/db";
import type { User, WorkspaceMember } from "@prisma/client";

const COOKIE_NAME = "cortex_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/* ---------------- password hashing (scrypt, timing-safe) ---------------- */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, saltHex, hashHex] = stored.split(":");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(password, salt, expected.length);
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/* ---------------- session token (compact JWT, HS256) ---------------- */

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function secret(): string {
  const s = process.env.APP_SECRET_KEY;
  if (s && s.length >= 16) return s;
  // Ephemeral fallback so the app still boots without APP_SECRET_KEY
  // (sessions then reset on restart). Configured in this environment.
  const g = globalThis as { __cortexEphemeralSecret?: string };
  if (!g.__cortexEphemeralSecret) {
    g.__cortexEphemeralSecret = crypto.randomBytes(32).toString("hex");
    console.warn("[cortex] APP_SECRET_KEY is not set; using an ephemeral session secret.");
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
  } catch {
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
  const secure = process.env.COOKIE_SECURE === "true";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
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
