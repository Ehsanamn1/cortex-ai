import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    memoryEntry: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  extractExplicitMemories,
  loadAgentMemory,
  remember,
} from "@/lib/runtime/memory";

describe("Cortex durable memory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.memoryEntry.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(db.memoryEntry.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(db.memoryEntry.upsert).mockResolvedValue({ id: "memory-1" } as never);
  });

  test("recalls global agent memory plus conversation and user-scoped memory without crossing workspace scope", async () => {
    const now = new Date();
    vi.mocked(db.memoryEntry.findMany).mockResolvedValue([
      {
        id: "global",
        workspaceId: "ws-1",
        agentId: "agent-1",
        conversationId: null,
        scope: "conversation",
        subjectKey: null,
        key: "business.name",
        value: "Cortex AI",
        type: "profile",
        metadata: null,
        importance: 80,
        confidence: 95,
        source: "explicit",
        lastAccessedAt: now,
        expiresAt: null,
        supersededById: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "user",
        workspaceId: "ws-1",
        agentId: "agent-1",
        conversationId: null,
        scope: "user",
        subjectKey: "web:user-1",
        key: "preference.response_style",
        value: "کوتاه",
        type: "preference",
        metadata: null,
        importance: 80,
        confidence: 90,
        source: "explicit_user",
        lastAccessedAt: now,
        expiresAt: null,
        supersededById: null,
        createdAt: now,
        updatedAt: now,
      },
    ] as never);

    const result = await loadAgentMemory("agent-1", 12, "conv-1", "web:user-1", "ws-1");

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.key)).toEqual(
      expect.arrayContaining(["business.name", "preference.response_style"]),
    );

    expect(vi.mocked(db.memoryEntry.findMany)).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        agentId: "agent-1",
        workspaceId: "ws-1",
        OR: expect.arrayContaining([
          { conversationId: "conv-1" },
          { conversationId: null, scope: "conversation", subjectKey: null },
          { conversationId: null, scope: "user", subjectKey: "web:user-1" },
        ]),
      }),
      orderBy: { updatedAt: "desc" },
    }));
  });

  test("extracts explicit profile and preference facts", () => {
    const memories = extractExplicitMemories(
      "اسم من سارا است. شرکت من آریا است. من علاقه‌مندم به فروش B2B. ترجیح می‌دهم پاسخ‌ها کوتاه و مستقیم باشند.",
    );

    expect(memories).toEqual(expect.arrayContaining([
      { key: "profile.name", value: "سارا", type: "profile" },
      { key: "profile.company", value: "آریا", type: "profile" },
      { key: "preference.topic", value: "فروش B2B", type: "preference" },
      { key: "preference.response_style", value: "پاسخ‌ها کوتاه و مستقیم باشند", type: "preference" },
    ]));
  });

  test("applies sensible retention defaults and normalizes long values", async () => {
    const result = await remember({
      workspaceId: "ws-1",
      agentId: "agent-1",
      conversationId: "conv-1",
      key: "conversation:conv-1:last_user",
      value: "  سلام  ",
      type: "interaction",
    });

    expect(result).toEqual({ id: "memory-1" });
    const call = vi.mocked(db.memoryEntry.upsert).mock.calls[0]?.[0] as any;
    expect(call.create.value).toBe("سلام");
    expect(call.create.type).toBe("interaction");
    expect(call.create.expiresAt).toBeInstanceOf(Date);
    expect(call.create.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(call.update.expiresAt).toBeInstanceOf(Date);
  });
});
