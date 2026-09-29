import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { POST as signup } from "@/app/api/auth/signup/route";
import { GET as me } from "@/app/api/auth/me/route";
import { GET as workspaces } from "@/app/api/workspaces/route";
import { GET as dashboard } from "@/app/api/dashboard/route";
import { GET as billing } from "@/app/api/billing/route";
import { POST as createAgent, GET as listAgents } from "@/app/api/agents/route";
import { GET as getAgent } from "@/app/api/agents/[id]/route";
import { POST as createTelegramBot } from "@/app/api/telegram/bots/route";
import { PATCH as patchTelegramProfile, GET as getTelegramProfile } from "@/app/api/telegram/bots/[id]/profile/route";
import { POST as reconnectTelegramBot } from "@/app/api/telegram/bots/[id]/connect/route";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("Cortex lifecycle integration", () => {
  let cookie = "";
  let userId = "";
  let workspaceId = "";
  let agentId = "";
  let botId = "";

  async function json(response: Response) {
    return await response.json() as any;
  }

  async function authed(url: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("cookie", cookie);
    return new Request(url, { ...init, headers });
  }

  beforeEach(() => {
    process.env.CORTEX_USD_TOMAN_RATE = "235175";
    vi.restoreAllMocks();
  });

  it("runs signup -> workspace -> billing -> agent -> Telegram -> profile tune -> reconnect", async () => {
    const suffix = String(Date.now()) + Math.floor(Math.random() * 1000);
    const email = "qa-lifecycle-" + suffix + "@example.invalid";
    const password = "Cortex-QA-2026!";

    const signupResponse = await signup(new Request("http://qa.local/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Cortex QA", email, password }),
    }));
    expect(signupResponse.status).toBe(201);
    const signupBody = await json(signupResponse);
    cookie = signupResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
    userId = signupBody.user.id;
    workspaceId = signupBody.workspaces[0].id;
    expect(cookie).toMatch(/^cortex_session=/);

    const meResponse = await me(await authed("http://qa.local/api/auth/me"));
    expect(meResponse.status).toBe(200);
    expect((await json(meResponse)).user.id).toBe(userId);

    const workspacesResponse = await workspaces(await authed("http://qa.local/api/workspaces"));
    expect(workspacesResponse.status).toBe(200);
    expect((await json(workspacesResponse)).workspaces).toHaveLength(1);

    const billingResponse = await billing(await authed("http://qa.local/api/billing?workspaceId=" + workspaceId));
    expect(billingResponse.status).toBe(200);
    expect((await json(billingResponse)).account.plan.key).toBe("free");

    const dashboardResponse = await dashboard(await authed("http://qa.local/api/dashboard?workspaceId=" + workspaceId));
    expect(dashboardResponse.status).toBe(200);
    expect((await json(dashboardResponse)).stats.agents).toBe(0);

    const agentResponse = await createAgent(await authed("http://qa.local/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        name: "QA Agent",
        language: "fa",
        tone: "friendly",
        instructions: "برای تست یک دستیار دقیق و کوتاه‌گو باش.",
      }),
    }));
    expect(agentResponse.status).toBe(201);
    const agentBody = await json(agentResponse);
    agentId = agentBody.agent.id;

    const listResponse = await listAgents(await authed("http://qa.local/api/agents?workspaceId=" + workspaceId));
    expect(listResponse.status).toBe(200);
    expect((await json(listResponse)).agents[0].id).toBe(agentId);

    const detailResponse = await getAgent(await authed("http://qa.local/api/agents/" + agentId + "?workspaceId=" + workspaceId), {
      params: Promise.resolve({ id: agentId }),
    });
    expect(detailResponse.status).toBe(200);

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      let result: any = true;
      if (url.endsWith("/getMe")) {
        result = { id: 4200, is_bot: true, first_name: "Cortex QA", username: "cortex_qa_bot" };
      } else if (url.endsWith("/getWebhookInfo")) {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        result = { url: body.__qa_expected_url ?? process.env.CORTEX_QA_WEBHOOK_URL ?? "" };
      }
      const responseBody = JSON.stringify({ ok: true, result });
      return new Response(responseBody, { status: 200, headers: { "content-type": "application/json" } });
    });

    process.env.APP_PUBLIC_URL = "http://qa.local";
    process.env.CORTEX_QA_WEBHOOK_URL = "http://qa.local/api/telegram/webhook/qa";
    const botResponse = await createTelegramBot(await authed("http://qa.local/api/telegram/bots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        agentId,
        name: "QA Telegram",
        token: "123456:QA-TEST-TOKEN",
        mode: "webhook",
      }),
    }));
    expect(botResponse.status).toBe(201);
    const botBody = await json(botResponse);
    botId = botBody.bot.id;
    expect(botBody.bot.status).toBe("connected");
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(8);

    const profileResponse = await patchTelegramProfile(await authed("http://qa.local/api/telegram/bots/" + botId + "/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: "Cortex QA فارسی",
        shortDescription: "دستیار QA",
        description: "پروفایل آزمایشی",
        blockedText: "این حساب مسدود شده است.",
        errorText: "خطای آزمایشی",
        accessRequiredText: "نیاز به دسترسی دارید.",
        commands: [
          { command: "/start", description: "شروع" },
          { command: "help", description: "راهنما" },
        ],
      }),
    }), { params: Promise.resolve({ id: botId }) });
    expect(profileResponse.status).toBe(200);
    const profileBody = await json(profileResponse);
    expect(profileBody.sync.ok).toBe(true);
    expect(profileBody.profile.blockedText).toContain("مسدود");

    const savedProfileResponse = await getTelegramProfile(await authed("http://qa.local/api/telegram/bots/" + botId + "/profile"), {
      params: Promise.resolve({ id: botId }),
    });
    expect((await json(savedProfileResponse)).profile.displayName).toBe("Cortex QA فارسی");

    const reconnectResponse = await reconnectTelegramBot(
      await authed("http://qa.local/api/telegram/bots/" + botId + "/connect", { method: "POST" }),
      { params: Promise.resolve({ id: botId }) },
    );
    expect(reconnectResponse.status).toBe(200);
    expect((await json(reconnectResponse)).bot.status).toBe("connected");
  });

  afterAll(async () => {
    if (workspaceId) await db.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    delete process.env.CORTEX_USD_TOMAN_RATE;
    delete process.env.CORTEX_QA_WEBHOOK_URL;
    delete process.env.APP_PUBLIC_URL;
  });
});
