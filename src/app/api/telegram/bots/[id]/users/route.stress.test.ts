import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { signSessionToken } from "@/lib/server/auth";
import { GET as getTelegramUsers } from "@/app/api/telegram/bots/[id]/users/route";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("Telegram 1000-user integration stress", () => {
  let userId = "";
  let workspaceId = "";
  let botId = "";
  let token = "";

  beforeAll(async () => {
    const suffix = String(Date.now());
    const user = await db.user.create({
      data: {
        email: "qa-telegram-" + suffix + "@example.invalid",
        name: "Cortex QA",
        passwordHash: "qa-only",
      },
    });
    userId = user.id;

    const workspace = await db.workspace.create({
      data: {
        name: "QA Telegram " + suffix,
        ownerId: user.id,
        members: { create: { userId: user.id, role: "owner" } },
      },
    });
    workspaceId = workspace.id;

    const agent = await db.agent.create({
      data: {
        workspaceId,
        name: "QA Agent",
        language: "fa",
        tone: "professional",
        modelKey: "launch-fast",
      },
    });

    const bot = await db.telegramBot.create({
      data: {
        workspaceId,
        agentId: agent.id,
        name: "QA Telegram Bot",
        tokenEncrypted: "qa-only",
        username: "qa_bot",
        status: "connected",
        mode: "webhook",
      },
    });
    botId = bot.id;
    token = signSessionToken(user.id);

    const users = Array.from({ length: 1000 }, (_, index) => ({
      botId,
      telegramUserId: String(10_000_000 + index),
      phoneNumber: "98912" + String(index).padStart(7, "0"),
      username: "qa_user_" + String(index).padStart(4, "0"),
      firstName: "کاربر " + String(index).padStart(4, "0"),
      lastName: "آزمایش",
      status: index % 15 === 0 ? "blocked" : "allowed",
      dailyMessageLimit: 100,
      monthlyMessageLimit: 2000,
      dailyTokenLimit: 10000,
      monthlyTokenLimit: 200000,
    }));
    await db.telegramUser.createMany({ data: users });
    const seededUsers = await db.telegramUser.findMany({
      where: { botId },
      select: { id: true },
      orderBy: { telegramUserId: "asc" },
    });

    await db.usageEvent.createMany({
      data: seededUsers.map((user, index) => ({
        workspaceId,
        agentId: agent.id,
        telegramBotId: botId,
        telegramUserId: user.id,
        channel: "telegram",
        provider: "qa",
        model: "qa-model",
        inputTokens: index + 1,
        outputTokens: index + 2,
        totalTokens: index + 3,
        estimatedCostMicros: index + 10,
      })),
    });
  });

  function request(query = "limit=100") {
    return getTelegramUsers(
      new Request("http://qa.local/api/telegram/bots/" + botId + "/users?" + query, {
        headers: { cookie: "cortex_session=" + token },
      }),
      { params: Promise.resolve({ id: botId }) },
    );
  }

  it("serves a 1000-user dataset through bounded pagination and search", async () => {
    const started = performance.now();
    const response = await request("limit=100");
    expect(response.status).toBe(200);
    const body = await response.json() as { users: unknown[]; totalCount: number; hasMore: boolean };
    expect(body.users).toHaveLength(100);
    expect(body.totalCount).toBe(1000);
    expect(body.hasMore).toBe(true);
    expect(performance.now() - started).toBeLessThan(8000);

    const searchResponse = await request("limit=30&search=qa_user_0420");
    expect(searchResponse.status).toBe(200);
    const searchBody = await searchResponse.json() as { users: Array<{ username?: string }>; totalCount: number; hasMore: boolean };
    expect(searchBody.totalCount).toBe(1);
    expect(searchBody.users[0]?.username).toBe("qa_user_0420");
    expect(searchBody.hasMore).toBe(false);
  });

  it("survives 1000 concurrent-at-the-service-level read requests in bounded waves", async () => {
    const durations: number[] = [];
    const errors: unknown[] = [];
    const totalRequests = 1000;
    const batchSize = 25;
    const started = performance.now();

    for (let offset = 0; offset < totalRequests; offset += batchSize) {
      const batch = Array.from({ length: Math.min(batchSize, totalRequests - offset) }, (_, batchIndex) => {
        const index = offset + batchIndex;
        return (async () => {
          const t0 = performance.now();
          try {
            const response = await request("limit=50&offset=" + ((index * 17) % 950));
            if (response.status !== 200) throw new Error("HTTP " + response.status);
            const body = await response.json() as { users: unknown[]; totalCount: number };
            if (body.users.length < 1 || body.totalCount !== 1000) throw new Error("unexpected pagination response");
          } catch (error) {
            errors.push(error);
          } finally {
            durations.push(performance.now() - t0);
          }
        })();
      });
      await Promise.all(batch);
    }

    durations.sort((a, b) => a - b);
    const percentile = (p: number) => durations[Math.min(durations.length - 1, Math.ceil(durations.length * p) - 1)] ?? 0;
    const totalMs = performance.now() - started;

    expect(errors).toHaveLength(0);
    expect(durations).toHaveLength(totalRequests);
    expect(percentile(0.50)).toBeLessThan(2500);
    expect(percentile(0.95)).toBeLessThan(7000);
    expect(percentile(0.99)).toBeLessThan(9000);
    expect(totalMs).toBeLessThan(180_000);
  }, 240_000);

  afterAll(async () => {
    if (workspaceId) await db.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
  });
});
