import { describe, expect, test, vi, beforeEach } from "vitest";

const afterMock = vi.fn();

vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => {
    afterMock(fn);
  },
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    telegramBot: { findUnique: vi.fn(), updateMany: vi.fn() },
    telegramProcessedUpdate: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/server/secrets", () => ({
  decryptSecret: vi.fn(() => "secret"),
}));

vi.mock("@/lib/telegram/service", () => ({
  processTelegramUpdate: vi.fn(async () => undefined),
}));

import { db } from "@/lib/db";
import { processTelegramUpdate } from "@/lib/telegram/service";
import { POST } from "@/app/api/telegram/webhook/[botId]/route";

describe("Telegram webhook idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterMock.mockReset();
    vi.mocked(db.telegramBot.findUnique).mockResolvedValue({
      id: "bot-1",
      webhookSecretEncrypted: "encrypted",
    } as never);
    vi.mocked(db.telegramBot.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.telegramProcessedUpdate.findUnique).mockResolvedValue(null);
    vi.mocked(db.telegramProcessedUpdate.create).mockResolvedValue({
      id: "ledger-1",
      status: "processing",
      attempts: 1,
      updatedAt: new Date(),
    } as never);
    vi.mocked(db.telegramProcessedUpdate.update).mockResolvedValue({} as never);
  });

  test("acknowledges immediately and processes exactly one fresh update", async () => {
    const req = new Request("https://example.test/api/telegram/webhook/bot-1", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "secret", "content-type": "application/json" },
      body: JSON.stringify({ update_id: 123, message: { text: "hello" } }),
    });

    const response = await POST(req, { params: Promise.resolve({ botId: "bot-1" }) });
    expect(response.status).toBe(200);
    expect(afterMock).toHaveBeenCalledTimes(1);

    await afterMock.mock.calls[0][0]();

    expect(db.telegramProcessedUpdate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ botId: "bot-1", updateId: 123, status: "processing" }),
    }));
    expect(vi.mocked(processTelegramUpdate)).toHaveBeenCalledTimes(1);
    expect(db.telegramProcessedUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "ledger-1" },
      data: expect.objectContaining({ status: "completed" }),
    }));
  });

  test("does not process a recently processing duplicate", async () => {
    vi.mocked(db.telegramProcessedUpdate.findUnique).mockResolvedValue({
      id: "ledger-existing",
      status: "processing",
      attempts: 1,
      updatedAt: new Date(),
    } as never);

    const req = new Request("https://example.test/api/telegram/webhook/bot-1", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "secret", "content-type": "application/json" },
      body: JSON.stringify({ update_id: 123, message: { text: "duplicate" } }),
    });

    const response = await POST(req, { params: Promise.resolve({ botId: "bot-1" }) });
    await afterMock.mock.calls[0][0]();

    expect(response.status).toBe(200);
    expect(vi.mocked(processTelegramUpdate)).not.toHaveBeenCalled();
    expect(db.telegramProcessedUpdate.create).not.toHaveBeenCalled();
  });

  test("completed duplicate is ignored", async () => {
    vi.mocked(db.telegramProcessedUpdate.findUnique).mockResolvedValue({
      id: "ledger-existing",
      status: "completed",
      attempts: 1,
      updatedAt: new Date(),
    } as never);

    const req = new Request("https://example.test/api/telegram/webhook/bot-1", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "secret", "content-type": "application/json" },
      body: JSON.stringify({ update_id: 124, message: { text: "duplicate" } }),
    });

    await POST(req, { params: Promise.resolve({ botId: "bot-1" }) });
    await afterMock.mock.calls[0][0]();

    expect(vi.mocked(processTelegramUpdate)).not.toHaveBeenCalled();
  });
});
