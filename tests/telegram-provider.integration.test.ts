import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    telegramBot: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    agent: {
      findUniqueOrThrow: vi.fn(),
    },
    telegramUser: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    conversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    usageEvent: {
      create: vi.fn(),
    },
    usageReservation: {
      delete: vi.fn(),
    },
    $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations)),
  },
}));

vi.mock("@/lib/server/secrets", () => ({
  decryptSecret: vi.fn(() => "telegram-token"),
}));

vi.mock("@/lib/server/usage", () => ({
  reserveUsageWithinLimits: vi.fn(async () => "reservation-1"),
  releaseUsageReservation: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telegram/profile", () => ({
  getTelegramBotProfile: vi.fn(async () => ({
    botId: "bot-1",
    displayName: "Test Bot",
    shortDescription: "Test",
    description: "Test",
    welcomeTitle: "✨ خوش آمدید",
    welcomeText: "شروع کن",
    welcomeBannerUrl: "",
    helpText: "راهنما",
    newChatText: "گفتگوی جدید آماده است.",
    blockedText: "⛔ مسدود",
    errorText: "خطا",
    thinkingMessages: ["🧠 فکر"],
    newChatButtonText: "🆕 جدید",
    helpButtonText: "❓ راهنما",
    usageButtonText: "📊 مصرف",
    showThinking: true,
    showWelcomeBanner: false,
    commands: [],
  })),
}));

vi.mock("@/lib/runtime/tools", () => ({
  listAgentTools: vi.fn(async () => []),
}));

vi.mock("@/lib/runtime/engine", () => ({
  runAgentExecution: vi.fn(async ({ input }: { input: string }) => ({
    executionId: "execution-1",
    content: "پاسخ از Provider اختصاصی این ایجنت",
    provider: "Mock Provider",
    model: "mock-telegram-model",
    retrieval: [],
    auxiliaryInputTokens: 0,
    auxiliaryOutputTokens: 0,
    latencyMs: 12,
    toolUsed: null,
  })),
}));

vi.mock("@/lib/rag/pipeline", () => ({
  RAG_QUERY_EXPANSION_RESERVE_TOKENS: 384,
  answerWithKnowledge: vi.fn(async () => ({
    content: "پاسخ از Provider اختصاصی این ایجنت",
    provider: "Mock Provider",
    model: "mock-telegram-model",
    latencyMs: 12,
    retrieval: [],
    auxiliaryInputTokens: 0,
    auxiliaryOutputTokens: 0,
  })),
  toSourceRefs: vi.fn(() => []),
  toRetrievalDebug: vi.fn(() => []),
}));

import { db } from "@/lib/db";
import { processTelegramUpdate } from "@/lib/telegram/service";

describe("Telegram -> agent provider simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(db.telegramBot.findUnique).mockResolvedValue({
      id: "bot-1",
      workspaceId: "workspace-1",
      agentId: "agent-telegram-1",
      tokenEncrypted: "encrypted-token",
      status: "connected",
      lastSeenAt: null,
      lastError: null,
    } as never);

    vi.mocked(db.telegramUser.upsert).mockResolvedValue({
      id: "tg-user-1",
      botId: "bot-1",
      telegramUserId: "123",
      status: "pending",
      username: "tester",
      firstName: "Test",
      lastName: "User",
      phoneNumber: null,
      dailyMessageLimit: 0,
      monthlyMessageLimit: 0,
      dailyTokenLimit: 0,
      monthlyTokenLimit: 0,
      lastSeenAt: new Date(),
    } as never);

    vi.mocked(db.conversation.findFirst).mockResolvedValue({
      id: "conversation-1",
      agentId: "agent-telegram-1",
      channel: "telegram",
      externalUserId: "123",
      telegramBotId: "bot-1",
      updatedAt: new Date(),
    } as never);

    vi.mocked(db.message.findMany).mockResolvedValue([]);
    vi.mocked(db.message.create).mockResolvedValue({ id: "message-1" } as never);
    vi.mocked(db.conversation.update).mockResolvedValue({ id: "conversation-1" } as never);
    vi.mocked(db.telegramBot.update).mockResolvedValue({ id: "bot-1" } as never);

    vi.mocked(db.agent.findUniqueOrThrow).mockResolvedValue({
      id: "agent-telegram-1",
      workspaceId: "workspace-1",
      maxTokens: 1200,
      name: "تلگرام",
      language: "fa",
      tone: "professional",
      memoryEnabled: true,
      citationsEnabled: true,
    } as never);

    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify({ ok: true, result: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    ));
  });

  test("Telegram keeps the Agent identity and reaches answer generation", async () => {
    await processTelegramUpdate("bot-1", {
      update_id: 10,
      message: {
        from: { id: 123, username: "tester", first_name: "Test", last_name: "User" },
        chat: { id: 456 },
        text: "سلام، یک سؤال واقعی دارم",
      },
    });

    const rag = await import("@/lib/rag/pipeline");
    expect(vi.mocked(rag.answerWithKnowledge)).toHaveBeenCalledWith(expect.objectContaining({
      agentId: "agent-telegram-1",
      workspaceId: "workspace-1",
      memorySubjectKey: "telegram:bot-1:123",
      question: "سلام، یک سؤال واقعی دارم",
    }));
    expect(vi.mocked(db.telegramUser.update)).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "tg-user-1" },
      data: { status: "allowed" },
    }));

    const fetchMock = vi.mocked(globalThis.fetch);
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/sendMessage"))).toBe(true);
    expect(vi.mocked(db.usageEvent.create)).toHaveBeenCalled();
  });
});
