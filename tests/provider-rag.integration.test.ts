import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    agentProviderConfig: { findUnique: vi.fn() },
    providerConfig: { findUnique: vi.fn() },
    knowledgeSource: { findMany: vi.fn(), count: vi.fn() },
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

import { db } from "@/lib/db";
import { answerWithKnowledge } from "@/lib/rag/pipeline";

describe("agent provider -> RAG end-to-end simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LLM_PROVIDER", "none");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        expect(body.model).toBe("mock-rag-model");
        expect(body.messages.at(-1)).toEqual({
          role: "user",
          content: "قیمت محصول چقدر است؟",
        });

        return new Response(JSON.stringify({
          choices: [{ message: { content: "قیمت محصول ۱۰ میلیون تومان است." } }],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    vi.mocked(db.agentProviderConfig.findUnique).mockResolvedValue({
      id: "provider-1",
      agentId: "agent-rag-1",
      workspaceId: "workspace-1",
      providerName: "Mock Provider",
      baseUrl: "https://provider.example/v1",
      model: "mock-rag-model",
      authMode: "bearer",
      apiKeyEncrypted: "secret",
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    vi.mocked(db.providerConfig.findUnique).mockResolvedValue(null);
    vi.mocked(db.knowledgeSource.findMany).mockResolvedValue([]);
    vi.mocked(db.knowledgeChunk.count).mockResolvedValue(0);
    vi.mocked(db.memoryEntry.findMany).mockResolvedValue([]);
  });

  test("takes the configured agent provider all the way to final RAG generation", async () => {
    const result = await answerWithKnowledge({
      agentId: "agent-rag-1",
      workspaceId: "workspace-1",
      persona: {
        name: "فروش",
        language: "fa",
        tone: "professional",
        instructions: "به صورت دقیق پاسخ بده.",
      },
      history: [],
      question: "قیمت محصول چقدر است؟",
    });

    expect(result.content).toBe("قیمت محصول ۱۰ میلیون تومان است.");
    expect(result.provider).toBe("Mock Provider");
    expect(result.model).toBe("mock-rag-model");
  });

  test("fails honestly when the agent has no provider", async () => {
    vi.mocked(db.agentProviderConfig.findUnique).mockResolvedValue(null);
    vi.mocked(db.providerConfig.findUnique).mockResolvedValue(null);

    await expect(answerWithKnowledge({
      agentId: "agent-rag-1",
      workspaceId: "workspace-1",
      persona: { name: "فروش", language: "fa", tone: "professional" },
      history: [],
      question: "سؤال",
    })).rejects.toMatchObject({
      status: 503,
    });
  });
});
