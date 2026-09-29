import { db } from "@/lib/db";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { decryptSecret } from "@/lib/server/secrets";
import { getBotInfo, configureBotProfile } from "@/lib/telegram/service";
import { getTelegramBotProfile, invalidateTelegramBotProfile, profileUpdateData } from "@/lib/telegram/profile";

type Params = { params: Promise<{ id: string }> };

async function loadBot(session: Awaited<ReturnType<typeof requireSession>>, id: string) {
  const bot = await db.telegramBot.findUnique({ where: { id } });
  if (!bot) throw Object.assign(new Error("ربات تلگرام پیدا نشد."), { status: 404 });
  assertWorkspaceAccess(session, bot.workspaceId);
  return bot;
}

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const bot = await loadBot(session, (await params).id);
    return applyCors(jsonOk({ profile: await getTelegramBotProfile(bot.id) }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}

async function syncRemoteProfile(bot: Awaited<ReturnType<typeof loadBot>>) {
  const profile = await getTelegramBotProfile(bot.id);
  const token = decryptSecret(bot.tokenEncrypted);
  const info = await getBotInfo(token);
  const sync = await configureBotProfile(token, String(profile.displayName || bot.name), {
    shortDescription: profile.shortDescription,
    description: profile.description,
    commands: profile.commands,
  });
  await db.telegramBot.update({
    where: { id: bot.id },
    data: sync.ok
      ? { username: info?.username ?? bot.username, status: "connected", lastError: null }
      : {
          username: info?.username ?? bot.username,
          lastError: "همگام‌سازی Telegram ناقص بود: " + sync.failures.map((item) => item.method).join(", "),
        },
  });
  return { profile, sync };
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const bot = await loadBot(session, (await params).id);
    const membership = assertWorkspaceAccess(session, bot.workspaceId);
    if (!["owner", "admin"].includes(membership.role)) {
      throw Object.assign(new Error("دسترسی مدیریت ربات را ندارید."), { status: 403 });
    }

    const input = await readJson<Record<string, unknown>>(req);
    const data = profileUpdateData(input);
    const profile = await db.telegramBotProfile.upsert({
      where: { botId: bot.id },
      update: data,
      create: { botId: bot.id, ...(data as any) },
    });

    invalidateTelegramBotProfile(bot.id);

    try {
      const synced = await syncRemoteProfile(bot);
      return applyCors(jsonOk(synced), req.headers.get("origin"));
    } catch (error) {
      await db.telegramBot.update({
        where: { id: bot.id },
        data: { lastError: "پروفایل ذخیره شد اما همگام‌سازی Telegram انجام نشد." },
      }).catch(() => undefined);
      return applyCors(jsonOk({
        profile: await getTelegramBotProfile(bot.id),
        sync: {
          ok: false,
          failures: [{ method: "profile-sync", message: error instanceof Error ? error.message : "خطای نامشخص" }],
        },
      }), req.headers.get("origin"));
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const bot = await loadBot(session, (await params).id);
    const membership = assertWorkspaceAccess(session, bot.workspaceId);
    if (!["owner", "admin"].includes(membership.role)) {
      throw Object.assign(new Error("دسترسی مدیریت ربات را ندارید."), { status: 403 });
    }
    const body = await readJson<Record<string, unknown>>(req).catch(() => ({} as Record<string, unknown>));
    if (body.action !== undefined && body.action !== "sync") {
      return applyCors(jsonError("action نامعتبر است.", 400), req.headers.get("origin"));
    }
    const synced = await syncRemoteProfile(bot);
    return applyCors(jsonOk(synced), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
