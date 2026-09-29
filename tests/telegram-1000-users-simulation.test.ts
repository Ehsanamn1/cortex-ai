import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    telegramBot: { findUnique: vi.fn(), update: vi.fn() },
    telegramUser: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    agent: { findUniqueOrThrow: vi.fn() },
    message: { findMany: vi.fn(), create: vi.fn() },
    usageEvent: { create: vi.fn() },
    usageReservation: { delete: vi.fn() },
    $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations)),
  },
}));

vi.mock("@/lib/server/secrets", () => ({ decryptSecret: vi.fn(() => "telegram-token") }));
vi.mock("@/lib/server/usage", () => ({
  reserveUsageWithinLimits: vi.fn(async () => "reservation"),
  releaseUsageReservation: vi.fn(async () => undefined),
}));
vi.mock("@/lib/telegram/profile", () => ({
  getTelegramBotProfile: vi.fn(async () => ({
    botId: "bot-1000",
    displayName: "1000-user bot",
    shortDescription: "test",
    description: "test",
    welcomeTitle: "سلام",
    welcomeText: "به دستیار خوش آمدی",
    welcomeBannerUrl: "",
    helpText: "راهنما",
    newChatText: "گفتگوی جدید آماده است.",
    blockedText: "مسدود",
    errorText: "خطا",
    accessRequiredText: "ابتدا توسط مدیر ثبت شوید",
    thinkingMessages: ["🧠"],
    newChatButtonText: "🆕 جدید",
    helpButtonText: "❓ راهنما",
    usageButtonText: "📊 مصرف",
    showThinking: true,
    showWelcomeBanner: false,
    commands: [],
  })),
}));
vi.mock("@/lib/runtime/tools", () => ({ listAgentTools: vi.fn(async () => []) }));
vi.mock("@/lib/runtime/engine", () => ({
  runAgentExecution: vi.fn(async ({ input }: { input: string }) => ({
    executionId: "execution-1000",
    content: "پاسخ برای " + input,
    provider: "SimProvider",
    model: "sim-model",
    latencyMs: 5,
    retrieval: [],
    auxiliaryInputTokens: 0,
    auxiliaryOutputTokens: 0,
    toolUsed: null,
  })),
}));
vi.mock("@/lib/rag/pipeline", () => ({
  RAG_QUERY_EXPANSION_RESERVE_TOKENS: 384,
  answerWithKnowledge: vi.fn(async ({ question }: { question: string }) => ({
    content: "پاسخ برای " + question,
    provider: "SimProvider",
    model: "sim-model",
    latencyMs: 5,
    retrieval: [],
    auxiliaryInputTokens: 0,
    auxiliaryOutputTokens: 0,
  })),
  toSourceRefs: vi.fn(() => []),
  toRetrievalDebug: vi.fn(() => []),
}));
vi.mock("@/lib/telegram/phone", () => ({ normalizeTelegramPhone: vi.fn((v: string) => v) }));

import { db } from "@/lib/db";
import { processTelegramUpdate } from "@/lib/telegram/service";

describe("Telegram 1000-user simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.telegramBot.findUnique).mockResolvedValue({
      id: "bot-1000", workspaceId: "ws-1000", agentId: "agent-1000", tokenEncrypted: "enc", status: "connected",
    } as never);
    vi.mocked(db.agent.findUniqueOrThrow).mockResolvedValue({
      id: "agent-1000", workspaceId: "ws-1000", maxTokens: 256, name: "1000-user Agent",
      memoryEnabled: true, citationsEnabled: true, language: "fa", tone: "friendly",
    } as never);
    vi.mocked(db.telegramUser.upsert).mockImplementation((async ({ where }: { where: { botId_telegramUserId: { telegramUserId: string } } }) => ({
      id: "db-" + where.botId_telegramUserId.telegramUserId,
      botId: "bot-1000",
      telegramUserId: where.botId_telegramUserId.telegramUserId,
      status: "allowed",
      username: "user" + where.botId_telegramUserId.telegramUserId,
      firstName: "User",
      lastName: where.botId_telegramUserId.telegramUserId,
      phoneNumber: null,
      dailyMessageLimit: 0, monthlyMessageLimit: 0, dailyTokenLimit: 0, monthlyTokenLimit: 0,
      lastSeenAt: new Date(),
    } as never)) as never);
    vi.mocked(db.telegramUser.update).mockResolvedValue({} as never);
    vi.mocked(db.conversation.findFirst).mockImplementation((async ({ where }: { where: { externalUserId: string } }) => ({
      id: "conv-" + where.externalUserId,
      agentId: "agent-1000", channel: "telegram", externalUserId: where.externalUserId, telegramBotId: "bot-1000",
      updatedAt: new Date(),
    } as never)) as never);
    vi.mocked(db.message.findMany).mockResolvedValue([]);
    vi.mocked(db.message.create).mockResolvedValue({ id: "message" } as never);
    vi.mocked(db.conversation.update).mockResolvedValue({} as never);
    vi.mocked(db.telegramBot.update).mockResolvedValue({} as never);
    vi.mocked(db.usageEvent.create).mockResolvedValue({ id: "usage" } as never);
    vi.mocked(db.usageReservation.delete).mockResolvedValue({} as never);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    } as Response)));
  });

  test("processes 1000 independent user messages through Telegram -> Agent", async () => {
    const started = performance.now();
    const results = await Promise.all(Array.from({ length: 1000 }, (_, i) =>
      processTelegramUpdate("bot-1000", {
        update_id: 10_000 + i,
        message: {
          from: { id: 2_000_000 + i, username: "u" + i, first_name: "U" + i },
          chat: { id: 3_000_000 + i },
          text: "سؤال کاربر " + i,
        },
      })
    ));
    const elapsed = performance.now() - started;

    expect(results).toHaveLength(1000);
    expect(vi.mocked(db.telegramUser.upsert)).toHaveBeenCalledTimes(1000);
    expect(vi.mocked(db.usageEvent.create)).toHaveBeenCalledTimes(1000);
    expect(vi.mocked(db.message.create)).toHaveBeenCalledTimes(2000);
    expect(vi.mocked(globalThis.fetch).mock.calls.filter(([input]) => String(input).includes("/sendMessage")).length).toBeGreaterThanOrEqual(1000);
    expect(elapsed).toBeLessThan(15_000);
  }, 30_000);
});
