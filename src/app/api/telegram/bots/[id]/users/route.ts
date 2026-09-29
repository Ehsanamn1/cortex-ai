import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function safeLimit(value: unknown, fallback = 100): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(200, Math.floor(n)) : fallback;
}
function safeLimitValue(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.min(10_000_000, Math.floor(n)) : undefined;
}
function safeOffset(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.min(100_000, Math.floor(n)) : 0;
}

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function loadBotForSession(req: Request, id: string) {
  const session = await requireSession(req);
  const bot = await db.telegramBot.findUnique({
    where: { id },
    select: { id: true, workspaceId: true },
  });
  if (!bot) throw Object.assign(new Error("ربات تلگرام یافت نشد."), { status: 404 });
  const membership = assertWorkspaceAccess(session, bot.workspaceId);
  return { session, bot, membership };
}

async function serializeUsers(botId: string, search = "", limit = 100, offset = 0) {
  const q = search.trim();
  const where = {
    botId,
    ...(q ? {
      OR: [
        { phoneNumber: { contains: q, mode: "insensitive" as const } },
        { username: { contains: q, mode: "insensitive" as const } },
        { firstName: { contains: q, mode: "insensitive" as const } },
        { lastName: { contains: q, mode: "insensitive" as const } },
        { telegramUserId: { contains: q } },
      ],
    } : {}),
  };
  const [users, totalCount] = await Promise.all([
    db.telegramUser.findMany({
      where,
      orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    db.telegramUser.count({ where }),
  ]);
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return { users: [], totalCount, hasMore: false };

  const [total, daily, monthly] = await Promise.all([
    db.usageEvent.groupBy({
      by: ["telegramUserId"],
      where: { telegramUserId: { in: ids } },
      _sum: { totalTokens: true, inputTokens: true, outputTokens: true, estimatedCostMicros: true },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    db.usageEvent.groupBy({
      by: ["telegramUserId"],
      where: { telegramUserId: { in: ids }, createdAt: { gte: startOfDay() } },
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
    db.usageEvent.groupBy({
      by: ["telegramUserId"],
      where: { telegramUserId: { in: ids }, createdAt: { gte: startOfMonth() } },
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
  ]);

  const totalMap = new Map(total.map((x) => [
    x.telegramUserId,
    {
      events: x._count._all,
      tokens: x._sum.totalTokens ?? 0,
      inputTokens: x._sum.inputTokens ?? 0,
      outputTokens: x._sum.outputTokens ?? 0,
      estimatedCostMicros: x._sum.estimatedCostMicros ?? 0,
      lastUsedAt: x._max.createdAt?.toISOString() ?? null,
    },
  ]));
  const dailyMap = new Map(daily.map((x) => [
    x.telegramUserId,
    { events: x._count._all, tokens: x._sum.totalTokens ?? 0 },
  ]));
  const monthlyMap = new Map(monthly.map((x) => [
    x.telegramUserId,
    { events: x._count._all, tokens: x._sum.totalTokens ?? 0 },
  ]));

  const serializedUsers = users.map((user) => ({
    ...user,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    usage: totalMap.get(user.id) ?? {
      events: 0,
      tokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostMicros: 0,
      lastUsedAt: null,
    },
    dailyUsage: dailyMap.get(user.id) ?? { events: 0, tokens: 0 },
    monthlyUsage: monthlyMap.get(user.id) ?? { events: 0, tokens: 0 },
  }));
  return { users: serializedUsers, totalCount, hasMore: offset + users.length < totalCount };
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { bot } = await loadBotForSession(req, (await params).id);
    const url = new URL(req.url);
    const search = url.searchParams.get("search") ?? "";
    const limit = safeLimit(url.searchParams.get("limit"), 100);
    const offset = safeOffset(url.searchParams.get("offset"));
    return applyCors(jsonOk(await serializeUsers(bot.id, search, limit, offset)), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { bot, membership } = await loadBotForSession(req, (await params).id);
    if (!["owner", "admin"].includes(membership.role)) {
      return applyCors(jsonError("دسترسی مدیریت کاربران ربات را ندارید.", 403), req.headers.get("origin"));
    }

    const body = await readJson<Record<string, unknown>>(req);
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return applyCors(jsonError("شناسه کاربر لازم است.", 400), req.headers.get("origin"));

    const existing = await db.telegramUser.findFirst({
      where: { id, botId: bot.id },
    });
    if (!existing) return applyCors(jsonError("کاربر این ربات یافت نشد.", 404), req.headers.get("origin"));

    const data: Record<string, unknown> = {};
    if (typeof body.status === "string" && ["pending", "allowed", "blocked"].includes(body.status)) {
      data.status = body.status;
    }
    for (const key of ["dailyMessageLimit", "monthlyMessageLimit", "dailyTokenLimit", "monthlyTokenLimit"]) {
      const value = safeLimitValue(body[key]);
      if (value !== undefined) data[key] = value;
    }
    if (Object.keys(data).length === 0) {
      return applyCors(jsonError("هیچ تغییر معتبری ارسال نشده است.", 400), req.headers.get("origin"));
    }

    const user = await db.telegramUser.update({
      where: { id: existing.id },
      data,
    });
    return applyCors(jsonOk({
      user: {
        ...user,
        lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
