import { db } from "@/lib/db";

export type MemoryScope = "conversation" | "user";

function rankMemory(entry: {
  importance: number;
  confidence: number;
  updatedAt: Date;
  lastAccessedAt: Date;
}) {
  const ageHours = Math.max(0, (Date.now() - entry.updatedAt.getTime()) / 3_600_000);
  const accessAgeHours = Math.max(0, (Date.now() - entry.lastAccessedAt.getTime()) / 3_600_000);
  const recency = Math.max(0, 100 - Math.min(100, ageHours * 2));
  const access = Math.max(0, 100 - Math.min(100, accessAgeHours));
  return entry.importance * 0.55 + entry.confidence * 0.25 + recency * 0.15 + access * 0.05;
}

export async function loadAgentMemory(
  agentId: string,
  limit = 16,
  conversationId?: string | null,
  subjectKey?: string | null,
) {
  const safeLimit = Math.min(50, Math.max(1, limit));
  const entries = await db.memoryEntry.findMany({
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
    take: Math.min(50, safeLimit * 3),
  });

  const now = new Date();
  const ranked = entries
    .filter((entry) => !entry.expiresAt || entry.expiresAt > now)
    .filter((entry) => !entry.supersededById)
    .map((entry) => ({ entry, score: rankMemory(entry) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, safeLimit);

  if (ranked.length) {
    void db.memoryEntry.updateMany({
      where: { id: { in: ranked.map(({ entry }) => entry.id) } },
      data: { lastAccessedAt: now },
    }).catch(() => undefined);
  }

  return ranked.map(({ entry }) => entry);
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
  importance?: number;
  confidence?: number;
  source?: string;
  expiresAt?: Date | null;
}) {
  const scope = params.scope ?? (params.conversationId ? "conversation" : "user");
  const subjectKey = params.subjectKey ?? null;
  const id = [params.agentId, scope, subjectKey ?? "global", params.key].join(":");
  const importance = Math.max(0, Math.min(100, Math.floor(params.importance ?? (params.type === "preference" ? 75 : 60))));
  const confidence = Math.max(0, Math.min(100, Math.floor(params.confidence ?? 80)));

  return db.memoryEntry.upsert({
    where: { id },
    update: {
      value: params.value,
      conversationId: params.conversationId ?? null,
      scope,
      subjectKey,
      type: params.type ?? "fact",
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      importance,
      confidence,
      source: params.source ?? "explicit",
      expiresAt: params.expiresAt ?? null,
      lastAccessedAt: new Date(),
      supersededById: null,
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
      importance,
      confidence,
      source: params.source ?? "explicit",
      expiresAt: params.expiresAt ?? null,
      lastAccessedAt: new Date(),
    },
  });
}

export async function forgetMemory(params: {
  workspaceId: string;
  agentId: string;
  key?: string;
  subjectKey?: string;
  conversationId?: string;
}) {
  const hasSelector = Boolean(params.key || params.subjectKey || params.conversationId);
  if (!hasSelector) {
    throw Object.assign(new Error("برای حذف حافظه حداقل یک محدوده یا کلید مشخص کنید."), { status: 400 });
  }
  return db.memoryEntry.deleteMany({
    where: {
      workspaceId: params.workspaceId,
      agentId: params.agentId,
      ...(params.key ? { key: params.key } : {}),
      ...(params.subjectKey ? { subjectKey: params.subjectKey } : {}),
      ...(params.conversationId ? { conversationId: params.conversationId } : {}),
    },
  });
}

export async function buildConversationSummary(conversationId: string, maxChars = 4000) {
  const messages = await db.message.findMany({
    where: { conversationId, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: { role: true, content: true },
  });
  if (!messages.length) return null;
  return messages.reverse()
    .map((m) => (m.role === "user" ? "کاربر: " : "دستیار: ") + m.content.trim())
    .join("\n")
    .slice(-maxChars);
}

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
        importance: memory.type === "preference" ? 80 : 70,
        confidence: 90,
        source: "explicit_user",
      })
    )
  );
  return memories.length;
}
