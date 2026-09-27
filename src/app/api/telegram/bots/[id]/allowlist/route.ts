import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { normalizeTelegramPhone } from "@/lib/telegram/phone";
import { buildTelegramInviteLink, createTelegramInviteToken, hashTelegramInviteToken } from "@/lib/telegram/access";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
const MAX_BULK = 500;

function safeLimit(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.min(10_000_000, Math.floor(n)) : undefined;
}

async function loadBot(req: Request, id: string) {
  const session = await requireSession(req);
  const bot = await db.telegramBot.findUnique({ where: { id } });
  if (!bot) throw Object.assign(new Error("ربات یافت نشد."), { status: 404 });
  const membership = assertWorkspaceAccess(session, bot.workspaceId);
  if (!["owner", "admin"].includes(membership.role)) throw Object.assign(new Error("دسترسی مدیریت فهرست کاربران ندارید."), { status: 403 });
  return { session, bot };
}

function rawPhones(body: Record<string, unknown>): string[] {
  const raw = Array.isArray(body.phoneNumbers) ? body.phoneNumbers : typeof body.phoneNumber === "string" ? [body.phoneNumber] : [];
  return [...new Set(raw.filter((v): v is string => typeof v === "string").map(normalizeTelegramPhone).filter(v => v.length >= 8))];
}

function serialize(entry: any, username: string | null) {
  return {
    id: entry.id,
    botId: entry.botId,
    phoneNumber: entry.phoneNumber,
    displayName: entry.displayName,
    notes: entry.notes,
    status: entry.status,
    dailyMessageLimit: entry.dailyMessageLimit,
    monthlyMessageLimit: entry.monthlyMessageLimit,
    dailyTokenLimit: entry.dailyTokenLimit,
    monthlyTokenLimit: entry.monthlyTokenLimit,
    claimedTelegramUserId: entry.claimedTelegramUserId,
    inviteLink: entry.invitePlainToken ? buildTelegramInviteLink(username, entry.invitePlainToken) : null,
    invitePlainToken: undefined,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    inviteCreatedAt: entry.inviteCreatedAt?.toISOString() ?? null,
    claimedAt: entry.claimedAt?.toISOString() ?? null,
  };
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { bot } = await loadBot(req, (await params).id);
    const entries = await db.telegramAllowlistEntry.findMany({ where: { botId: bot.id }, orderBy: { createdAt: "desc" } });
    return applyCors(jsonOk({ entries: entries.map((entry) => serialize(entry, bot.username)) }), req.headers.get("origin"));
  } catch (e) { return toErrorResponse(e); }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { session, bot } = await loadBot(req, (await params).id);
    const body = await readJson<Record<string, unknown>>(req);
    const phones = rawPhones(body);
    if (!phones.length) return applyCors(jsonError("حداقل یک شماره موبایل معتبر وارد کنید.", 400), req.headers.get("origin"));
    if (phones.length > MAX_BULK) return applyCors(jsonError("حداکثر ۵۰۰ شماره در هر نوبت قابل افزودن است.", 400), req.headers.get("origin"));

    const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : null;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 300) : null;
    const defaultLimits = {
      dailyMessageLimit: safeLimit(body.dailyMessageLimit) ?? 0,
      monthlyMessageLimit: safeLimit(body.monthlyMessageLimit) ?? 0,
      dailyTokenLimit: safeLimit(body.dailyTokenLimit) ?? 0,
      monthlyTokenLimit: safeLimit(body.monthlyTokenLimit) ?? 0,
    };
    const regenerate = body.regenerate === true;
    const results = [];

    for (const phoneNumber of phones) {
      const existing = await db.telegramAllowlistEntry.findUnique({ where: { botId_phoneNumber: { botId: bot.id, phoneNumber } } });
      const needsToken = !existing || regenerate || !existing.inviteTokenHash;
      const plainToken = needsToken ? createTelegramInviteToken() : null;
      const entry = existing
        ? await db.telegramAllowlistEntry.update({
            where: { id: existing.id },
            data: {
              displayName: displayName ?? existing.displayName,
              notes: notes ?? existing.notes,
              status: "allowed",
              ...defaultLimits,
              ...(needsToken ? { inviteTokenHash: hashTelegramInviteToken(plainToken!), inviteCreatedAt: new Date(), claimedTelegramUserId: null, claimedAt: null } : {}),
            },
          })
        : await db.telegramAllowlistEntry.create({
            data: {
              botId: bot.id, phoneNumber, displayName, notes, status: "allowed", ...defaultLimits,
              inviteTokenHash: hashTelegramInviteToken(plainToken!), inviteCreatedAt: new Date(),
            },
          });

      const matchingUsers = await db.telegramUser.findMany({ where: { botId: bot.id, phoneNumber } });
      for (const user of matchingUsers) {
        await db.telegramUser.update({
          where: { id: user.id },
          data: {
            status: "allowed",
            dailyMessageLimit: entry.dailyMessageLimit, monthlyMessageLimit: entry.monthlyMessageLimit,
            dailyTokenLimit: entry.dailyTokenLimit, monthlyTokenLimit: entry.monthlyTokenLimit,
          },
        });
      }

      results.push(serialize({ ...entry, invitePlainToken: plainToken }, bot.username));
      await audit(bot.workspaceId, session.user.id, "telegram-access.added", "telegram_allowlist", entry.id, { phoneNumber });
    }

    return applyCors(jsonOk({ entries: results, count: results.length }, 201), req.headers.get("origin"));
  } catch (e) { return toErrorResponse(e); }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { bot } = await loadBot(req, (await params).id);
    const body = await readJson<Record<string, unknown>>(req);
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return applyCors(jsonError("شناسه دسترسی لازم است.", 400), req.headers.get("origin"));
    const existing = await db.telegramAllowlistEntry.findFirst({ where: { id, botId: bot.id } });
    if (!existing) return applyCors(jsonError("کاربر پیدا نشد.", 404), req.headers.get("origin"));
    const data: Record<string, unknown> = {};
    if (typeof body.status === "string" && ["allowed", "blocked"].includes(body.status)) data.status = body.status;
    for (const key of ["dailyMessageLimit", "monthlyMessageLimit", "dailyTokenLimit", "monthlyTokenLimit"]) {
      const value = safeLimit(body[key]);
      if (value !== undefined) data[key] = value;
    }
    if (!Object.keys(data).length) return applyCors(jsonError("هیچ تغییر معتبری ارسال نشده است.", 400), req.headers.get("origin"));
    const entry = await db.telegramAllowlistEntry.update({ where: { id: existing.id }, data });
    const status = entry.status === "allowed" ? "allowed" : "blocked";
    await db.telegramUser.updateMany({
      where: { botId: bot.id, phoneNumber: entry.phoneNumber },
      data: {
        status,
        dailyMessageLimit: entry.dailyMessageLimit,
        monthlyMessageLimit: entry.monthlyMessageLimit,
        dailyTokenLimit: entry.dailyTokenLimit,
        monthlyTokenLimit: entry.monthlyTokenLimit,
      },
    });
    return applyCors(jsonOk({ entry: serialize(entry, bot.username) }), req.headers.get("origin"));
  } catch (e) { return toErrorResponse(e); }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { session, bot } = await loadBot(req, (await params).id);
    const entryId = new URL(req.url).searchParams.get("entryId");
    if (!entryId) return applyCors(jsonError("entryId الزامی است.", 400), req.headers.get("origin"));
    const entry = await db.telegramAllowlistEntry.findUnique({ where: { id: entryId } });
    if (!entry || entry.botId !== bot.id) return applyCors(jsonError("کاربر پیدا نشد.", 404), req.headers.get("origin"));
    await db.telegramAllowlistEntry.delete({ where: { id: entry.id } });
    await db.telegramUser.updateMany({ where: { botId: bot.id, phoneNumber: entry.phoneNumber }, data: { status: "blocked" } });
    await audit(bot.workspaceId, session.user.id, "telegram-access.removed", "telegram_allowlist", entry.id, { phoneNumber: entry.phoneNumber });
    return applyCors(jsonOk({ ok: true }), req.headers.get("origin"));
  } catch (e) { return toErrorResponse(e); }
}
