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
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/server/secrets", () => ({ decryptSecret: vi.fn(() => "telegram-token") }));
vi.mock("@/lib/server/usage", () => ({
  reserveUsageWithinLimits: vi.fn(async () => "reservation"),
  releaseUsageReservation: vi.fn(async () => undefined),
}));
vi.mock("@/lib/telegram/profile", () => ({
  getTelegramBotProfile: vi.fn(async () => ({
    botId: "bot-10",
    displayName: "10-user bot",
    shortDescription: "test",
    description: "test",
    welcomeTitle: "سلام",
    welcomeText: "به دستیار خوش آمدی",
    welcomeBannerUrl: "",
    helpText: "راهنما",
    newChatText: "گفتگوی جدید آماده است.",
    blockedText: "مسدود",
    errorText: "خطا",
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
vi.mock("@/lib/rag/pipeline", () => ({
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

describe("Telegram 10-user simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.telegramBot.findUnique).mockResolvedValue({
      id: "bot-10", workspaceId: "ws-10", agentId: "agent-10", tokenEncrypted: "enc", status: "connected",
    } as never);
    vi.mocked(db.agent.findUniqueOrThrow).mockResolvedValue({
      id: "agent-10", workspaceId: "ws-10", maxTokens: 256, name: "10-user Agent",
      memoryEnabled: true, citationsEnabled: true, language: "fa", tone: "friendly",
    } as never);
    vi.mocked(db.telegramUser.upsert).mockImplementation(async ({ where }: any) => ({
      id: "db-" + where.botId_telegramUserId.telegramUserId,
      botId: "bot-10",
      telegramUserId: where.botId_telegramUserId.telegramUserId,
      status: "pending",
      username: "user" + where.botId_telegramUserId.telegramUserId,
      firstName: "User",
      lastName: where.botId_telegramUserId.telegramUserId,
      phoneNumber: null,
      dailyMessageLimit: 0, monthlyMessageLimit: 0, dailyTokenLimit: 0, monthlyTokenLimit: 0,
      lastSeenAt: new Date(),
    } as never));
    vi.mocked(db.telegramUser.update).mockResolvedValue({} as never);
    vi.mocked(db.conversation.findFirst).mockImplementation(async ({ where }: any) => ({
      id: "conv-" + where.externalUserId,
      agentId: "agent-10", channel: "telegram", externalUserId: where.externalUserId, telegramBotId: "bot-10",
      updatedAt: new Date(),
    } as never));
    vi.mocked(db.message.findMany).mockResolvedValue([]);
    vi.mocked(db.message.create).mockResolvedValue({ id: "message" } as never);
    vi.mocked(db.conversation.update).mockResolvedValue({} as never);
    vi.mocked(db.telegramBot.update).mockResolvedValue({} as never);
    vi.mocked(db.usageEvent.create).mockResolvedValue({ id: "usage" } as never);
    vi.mocked(db.usageReservation.delete).mockResolvedValue({} as never);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 })));
  });

  test("10 independent users can enter and chat without phone verification", async () => {
    await Promise.all(Array.from({ length: 10 }, (_, i) =>
      processTelegramUpdate("bot-10", {
        update_id: 100 + i,
        message: {
          from: { id: 1000 + i, username: "u" + i, first_name: "U" + i },
          chat: { id: 5000 + i },
          text: "سؤال کاربر " + i,
        },
      })
    ));

    expect(vi.mocked(db.telegramUser.upsert)).toHaveBeenCalledTimes(10);
    expect(vi.mocked(db.telegramUser.update)).toHaveBeenCalledTimes(10);
    expect(vi.mocked(db.usageEvent.create)).toHaveBeenCalledTimes(10);

    const fetchMock = vi.mocked(globalThis.fetch);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/sendMessage")).length).toBeGreaterThanOrEqual(20);
  });
});
