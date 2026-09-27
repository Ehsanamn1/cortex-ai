import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, toErrorResponse } from "@/lib/server/http";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { buildTelegramInviteLink, createTelegramInviteToken, hashTelegramInviteToken } from "@/lib/telegram/access";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string; entryId: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id: botId, entryId } = await params;
    const bot = await db.telegramBot.findUnique({ where: { id: botId } });
    if (!bot) return applyCors(jsonError("ربات یافت نشد.", 404), req.headers.get("origin"));
    const membership = assertWorkspaceAccess(session, bot.workspaceId);
    if (!["owner", "admin"].includes(membership.role)) return applyCors(jsonError("دسترسی مدیریت کاربران ربات را ندارید.", 403), req.headers.get("origin"));

    const entry = await db.telegramAllowlistEntry.findFirst({ where: { id: entryId, botId: bot.id } });
    if (!entry) return applyCors(jsonError("رکورد دسترسی یافت نشد.", 404), req.headers.get("origin"));

    const token = createTelegramInviteToken();
    const updated = await db.telegramAllowlistEntry.update({
      where: { id: entry.id },
      data: { inviteTokenHash: hashTelegramInviteToken(token), inviteCreatedAt: new Date(), status: "allowed" },
    });
    await audit(bot.workspaceId, session.user.id, "telegram-access.invite-regenerated", "telegram_allowlist", entry.id, { phoneNumber: entry.phoneNumber });

    return applyCors(jsonOk({
      entry: {
        ...updated,
        inviteLink: buildTelegramInviteLink(bot.username, token),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        inviteCreatedAt: updated.inviteCreatedAt?.toISOString() ?? null,
        claimedAt: updated.claimedAt?.toISOString() ?? null,
      },
    }), req.headers.get("origin"));
  } catch (e) { return toErrorResponse(e); }
}
