import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    telegramBot: { findUnique: vi.fn(), update: vi.fn() },
    telegramUser: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    telegramAllowlistEntry: { findUnique: vi.fn(), update: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    agent: { findUniqueOrThrow: vi.fn() },
    message: { findMany: vi.fn(), create: vi.fn() },
    usageEvent: { create: vi.fn(), aggregate: vi.fn() },
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
    botId: "bot-managed", displayName: "Managed", shortDescription: "test", description: "test", welcomeTitle: "سلام",
    welcomeText: "خوش آمدی", welcomeBannerUrl: "", helpText: "راهنما", newChatText: "جدید", blockedText: "مسدود",
    errorText: "خطا", accessRequiredText: "ابتدا توسط مدیر ثبت شوید", thinkingMessages: ["🧠"],
    newChatButtonText: "جدید", helpButtonText: "راهنما", usageButtonText: "مصرف", showThinking: false, showWelcomeBanner: false, commands: [],
  })),
}));
vi.mock("@/lib/runtime/tools", () => ({ listAgentTools: vi.fn(async () => []) }));
vi.mock("@/lib/runtime/engine", () => ({
  runAgentExecution: vi.fn(async ({ input }: { input: string }) => ({
    executionId: "exec", content: "پاسخ " + input, provider: "OpenAI", model: "gpt-5-mini", latencyMs: 3, retrieval: [], auxiliaryInputTokens: 0, auxiliaryOutputTokens: 0, toolUsed: null,
  })),
}));
vi.mock("@/lib/rag/pipeline", () => ({
  RAG_QUERY_EXPANSION_RESERVE_TOKENS: 384, toSourceRefs: vi.fn(() => []), toRetrievalDebug: vi.fn(() => []),
}));
vi.mock("@/lib/telegram/phone", () => ({ normalizeTelegramPhone: vi.fn((v: string) => v) }));

import { db } from "@/lib/db";
import { processTelegramUpdate } from "@/lib/telegram/service";

describe("Managed Telegram access journey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, result: { message_id: 10 } }), { status: 200 })));
    vi.mocked(db.telegramBot.findUnique).mockResolvedValue({ id: "bot-managed", workspaceId: "ws", agentId: "agent", tokenEncrypted: "enc", username: "managed_bot" } as never);
    vi.mocked(db.telegramBot.update).mockResolvedValue({} as never);
    vi.mocked(db.agent.findUniqueOrThrow).mockResolvedValue({ id: "agent", workspaceId: "ws", maxTokens: 256, name: "Agent", language: "fa", tone: "professional", memoryEnabled: true, citationsEnabled: true } as never);
    vi.mocked(db.conversation.findFirst).mockResolvedValue(null);
    vi.mocked(db.conversation.create).mockResolvedValue({ id: "conv", agentId: "agent", telegramBotId: "bot-managed", externalUserId: "77", channel: "telegram", updatedAt: new Date() } as never);
    vi.mocked(db.conversation.update).mockResolvedValue({} as never);
    vi.mocked(db.message.findMany).mockResolvedValue([]);
    vi.mocked(db.message.create).mockResolvedValue({ id: "message" } as never);
    vi.mocked(db.usageEvent.create).mockResolvedValue({ id: "usage" } as never);
    vi.mocked(db.usageReservation.delete).mockResolvedValue({} as never);
  });

  test("rejects an unapproved user before the Agent runtime", async () => {
    vi.mocked(db.telegramUser.upsert).mockResolvedValue({ id: "u-77", botId: "bot-managed", telegramUserId: "77", status: "pending" } as never);
    const runtime = await import("@/lib/runtime/engine");
    await processTelegramUpdate("bot-managed", { update_id: 1, message: { from: { id: 77 }, chat: { id: 77 }, text: "سلام" } });
    expect(vi.mocked(runtime.runAgentExecution)).not.toHaveBeenCalled();
    expect(vi.mocked(db.usageEvent.create)).not.toHaveBeenCalled();
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(expect.stringContaining("/sendMessage"), expect.anything());
  });

  test("claims an allowlisted phone via one-time start token and then chats", async () => {
    vi.mocked(db.telegramUser.upsert).mockResolvedValue({ id: "u-77", botId: "bot-managed", telegramUserId: "77", status: "pending", phoneNumber: null, dailyMessageLimit: 5, monthlyMessageLimit: 100, dailyTokenLimit: 1000, monthlyTokenLimit: 10000 } as never);
    vi.mocked(db.telegramAllowlistEntry.findUnique).mockResolvedValue({ id: "entry", botId: "bot-managed", phoneNumber: "09120000000", status: "allowed", claimedTelegramUserId: null, dailyMessageLimit: 5, monthlyMessageLimit: 100, dailyTokenLimit: 1000, monthlyTokenLimit: 10000 } as never);
    vi.mocked(db.telegramAllowlistEntry.update).mockResolvedValue({ id: "entry" } as never);
    await processTelegramUpdate("bot-managed", { update_id: 2, message: { from: { id: 77 }, chat: { id: 77 }, text: "/start AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } });
    expect(vi.mocked(db.telegramAllowlistEntry.update)).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ claimedTelegramUserId: "77", inviteTokenHash: null }) }));
    expect(vi.mocked(db.telegramUser.update)).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ phoneNumber: "09120000000", status: "allowed" }) }));

    vi.mocked(db.telegramUser.upsert).mockResolvedValue({ id: "u-77", botId: "bot-managed", telegramUserId: "77", status: "allowed", phoneNumber: "09120000000", dailyMessageLimit: 5, monthlyMessageLimit: 100, dailyTokenLimit: 1000, monthlyTokenLimit: 10000 } as never);
    await processTelegramUpdate("bot-managed", { update_id: 3, message: { from: { id: 77 }, chat: { id: 77 }, text: "قیمت را بگو" } });
    const runtime = await import("@/lib/runtime/engine");
    expect(vi.mocked(runtime.runAgentExecution)).toHaveBeenCalled();
    expect(vi.mocked(db.usageEvent.create)).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ telegramUserId: "u-77", estimatedCostMicros: 1 }) }));
  });
});