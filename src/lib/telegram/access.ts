import crypto from "node:crypto";
import { randomBytes } from "@/lib/server/random";

const TELEGRAM_START_TOKEN_RE = /^\/start(?:@\S+)?(?:\s+([A-Za-z0-9_-]{16,64}))?\s*$/i;

export function createTelegramInviteToken(): string {
  return Buffer.from(randomBytes(24)).toString("base64url");
}

export function hashTelegramInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function parseTelegramStartToken(text: string): string | null {
  const match = text.trim().match(TELEGRAM_START_TOKEN_RE);
  return match?.[1] ?? null;
}

export function buildTelegramInviteLink(username: string | null | undefined, token: string): string | null {
  const clean = String(username ?? "").replace(/^@/, "").trim();
  return clean ? "https://t.me/" + clean + "?start=" + encodeURIComponent(token) : null;
}
