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

    // Keep Telegram's own Bot API profile aligned with Cortex branding.
    try {
      const token = decryptSecret(bot.tokenEncrypted);
      const info = await getBotInfo(token);
      await configureBotProfile(token, String(input.displayName || bot.name), {
        shortDescription: profile.shortDescription,
        description: profile.description,
        commands: JSON.parse(profile.commandsJson || "[]"),
      });
      await db.telegramBot.update({
        where: { id: bot.id },
        data: { username: info?.username ?? bot.username, status: "connected", lastError: null },
      });
    } catch {
      // Customization is still saved locally; connection health is handled separately.
    }

    return applyCors(jsonOk({ profile: await getTelegramBotProfile(bot.id) }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
