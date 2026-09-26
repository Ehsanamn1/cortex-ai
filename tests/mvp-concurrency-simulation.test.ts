import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    agentProviderConfig: { findUnique: vi.fn() },
    providerConfig: { findUnique: vi.fn() },
    knowledgeSource: { findMany: vi.fn() },
    knowledgeChunk: { count: vi.fn(), findMany: vi.fn() },
    memoryEntry: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/server/secrets", () => ({
  decryptSecret: vi.fn((value: string) => value),
}));

vi.mock("@/lib/providers/embeddings/manager", () => ({
  embeddingManager: {
    resolve: vi.fn(() => null),
  },
}));

vi.mock("@/lib/runtime/memory", () => ({
  remember: vi.fn(async () => undefined),
}));

import { db } from "@/lib/db";
import { answerWithKnowledge } from "@/lib/rag/pipeline";

describe("Cortex MVP 1000-user concurrency simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LLM_PROVIDER", "none");

    vi.mocked(db.agentProviderConfig.findUnique).mockImplementation(async (args) => ({
      id: "agent-provider-1",
      agentId: String(args.where.agentId ?? "agent-shared"),
      workspaceId: "workspace-1",
      providerName: "Simulation Provider",
      baseUrl: "https://provider.example/v1",
      model: "simulation-model",
      authMode: "none",
      apiKeyEncrypted: null,
      enabled: true,
    }) as never);

    vi.mocked(db.providerConfig.findUnique).mockResolvedValue(null);
    vi.mocked(db.knowledgeSource.findMany).mockResolvedValue([]);
    vi.mocked(db.knowledgeChunk.count).mockResolvedValue(0);
    vi.mocked(db.memoryEntry.findMany).mockImplementation(async (args) => {
      const conversationId = String(args.where.conversationId);
      const userId = conversationId.replace("conversation-", "");
      return [{ key: "user_marker", value: "کاربر-" + userId }] as never;
    });

    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ role: string; content: string }>;
      };
      const question = body.messages.at(-1)?.content ?? "";
      await Promise.resolve();
      return new Response(JSON.stringify({
        choices: [{ message: { content: "پاسخ برای " + question } }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));
  });

  test("handles 1000 independent agent conversations concurrently without cross-user response mixing", async () => {
    const users = Array.from({ length: 1000 }, (_, index) => index);

    const results = await Promise.all(
      users.map((index) =>
        answerWithKnowledge({
          agentId: "agent-shared",
          workspaceId: "workspace-1",
          conversationId: "conversation-" + index,
          persona: {
            name: "ایجنت تست",
            language: "fa",
            tone: "professional",
            instructions: "پاسخ دقیق بده.",
            memoryEnabled: true,
            citationsEnabled: true,
          },
          history: [],
          question: "سؤال کاربر " + index,
        })
      )
    );

    expect(results).toHaveLength(1000);
    expect(new Set(results.map((result) => result.content)).size).toBe(1000);
    expect(results.every((result, index) => result.content === "پاسخ برای سؤال کاربر " + index)).toBe(true);
    expect(results.every((result) => result.provider === "Simulation Provider")).toBe(true);
    const calls = vi.mocked(globalThis.fetch).mock.calls;
    expect(calls).toHaveLength(1000);
    for (const [input, init] of calls) {
      const body = JSON.parse(String(init?.body)) as {
        messages: Array<{ role: string; content: string }>;
      };
      const question = body.messages.at(-1)?.content ?? "";
      const index = Number(question.match(/سؤال کاربر (\d+)/)?.[1] ?? -1);
      const system = body.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");
      expect(index).toBeGreaterThanOrEqual(0);
      expect(system).toContain("کاربر-" + index);
      expect(system).not.toContain("کاربر-" + (index === 999 ? 0 : index + 1));
    }
    expect(results.every((result) => result.model === "simulation-model")).toBe(true);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1000);
    expect(vi.mocked(db.agentProviderConfig.findUnique)).toHaveBeenCalledTimes(1000);
  });
});
