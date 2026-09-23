import { db } from "@/lib/db";
import { randomBytes } from "@/lib/server/random";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateAgentApiKey(): string {
  return "ck_live_" + base64Url(randomBytes(32));
}

export async function hashAgentApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function authenticateAgentApiKey(key: string) {
  const normalized = key.trim();
  if (!normalized.startsWith("ck_live_") || normalized.length < 40) return null;
  const keyHash = await hashAgentApiKey(normalized);
  const record = await db.agentApiKey.findUnique({ where: { keyHash }, include: { agent: true } });
  if (!record || !record.active || record.agent.status !== "active") return null;
  await db.agentApiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return record;
}

export function readAgentApiKey(req: Request): string | null {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer || req.headers.get("x-api-key")?.trim() || null;
}
