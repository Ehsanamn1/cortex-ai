import { db } from "@/lib/db";

export type MemoryScope = "conversation" | "user";

export async function loadAgentMemory(
  agentId: string,
  limit = 16,
  conversationId?: string | null,
  subjectKey?: string | null,
) {
  const safeLimit = Math.min(50, Math.max(1, limit));
  return db.memoryEntry.findMany({
    where: conversationId
      ? {
          agentId,
          OR: [
            { conversationId },
            ...(subjectKey ? [{ conversationId: null, scope: "user", subjectKey }] : []),
          ],
        }
      : subjectKey
        ? { agentId, conversationId: null, scope: "user", subjectKey }
        : { agentId, conversationId: null, scope: "conversation" },
    orderBy: { updatedAt: "desc" },
    take: safeLimit,
  });
}

export async function remember(params: {
  workspaceId: string;
  agentId: string;
  conversationId?: string | null;
  scope?: MemoryScope;
  subjectKey?: string | null;
  key: string;
  value: string;
  type?: string;
  metadata?: unknown;
}) {
  const scope = params.scope ?? (params.conversationId ? "conversation" : "user");
  const subjectKey = params.subjectKey ?? null;
  const id = [
    params.agentId,
    scope,
    subjectKey ?? "global",
    params.key,
  ].join(":");

  return db.memoryEntry.upsert({
    where: { id },
    update: {
      value: params.value,
      conversationId: params.conversationId ?? null,
      scope,
      subjectKey,
      type: params.type ?? "fact",
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
    create: {
      id,
      workspaceId: params.workspaceId,
      agentId: params.agentId,
      conversationId: params.conversationId ?? null,
      scope,
      subjectKey,
      key: params.key,
      value: params.value,
      type: params.type ?? "fact",
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}

/**
 * Fast, deterministic memory extraction.
 *
 * We deliberately store only explicit, low-risk profile/preferences stated by
 * the user. No addresses, phone numbers, credentials, health, financial or
 * other sensitive data is promoted into long-term memory automatically.
 */
export function extractExplicitMemories(text: string): Array<{ key: string; value: string; type: string }> {
  const input = text.replace(/\s+/g, " ").trim().slice(0, 1500);
  if (!input) return [];

  const patterns: Array<{ key: string; type: string; regex: RegExp }> = [
    { key: "profile.name", type: "profile", regex: /(?:اسم من|منو? صدا کن|my name is|call me)\s+([^،,.!?\n]{1,60})/iu },
    { key: "profile.role", type: "profile", regex: /(?:شغلم|من یک|من یه|I am a|I work as)\s+([^،,.!?\n]{2,80})/iu },
    { key: "profile.company", type: "profile", regex: /(?:شرکت(?:م| من)|محل کارم|my company is|I work at)\s+([^،,.!?\n]{2,100})/iu },
    { key: "preference.topic", type: "preference", regex: /(?:علاقه دارم به|علاقه‌مندم به|دوست دارم درباره|i (?:like|love|prefer))\s+([^.!?\n]{2,120})/iu },
    { key: "preference.response_style", type: "preference", regex: /(?:ترجیح میدم|ترجیح می‌دهم|ترجیح من اینه|please (?:keep|make) (?:your )?(?:answers|responses))\s+([^.!?\n]{2,140})/iu },
  ];

  const out: Array<{ key: string; value: string; type: string }> = [];
  for (const pattern of patterns) {
    const match = input.match(pattern.regex);
    const value = match?.[1]?.trim().replace(/^[:：-]\s*/, "");
    if (value && value.length >= 2) {
      out.push({ key: pattern.key, value: value.slice(0, 240), type: pattern.type });
    }
  }
  return out;
}

export async function rememberExplicitUserFacts(params: {
  workspaceId: string;
  agentId: string;
  subjectKey: string;
  text: string;
}) {
  const memories = extractExplicitMemories(params.text);
  if (memories.length === 0) return 0;

  await Promise.all(
    memories.map((memory) =>
      remember({
        workspaceId: params.workspaceId,
        agentId: params.agentId,
        scope: "user",
        subjectKey: params.subjectKey,
        key: memory.key,
        value: memory.value,
        type: memory.type,
      })
    )
  );
  return memories.length;
}
