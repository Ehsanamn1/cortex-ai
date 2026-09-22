import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decryptSecret } from '@/lib/server/secrets';
import { processTelegramUpdate } from '@/lib/telegram/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function getUpdates(token: string, offset: number) {
  const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ offset, timeout: 5, allowed_updates: ['message'] }),
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await r.json()) as { ok?: boolean; description?: string; result?: unknown[] };
  if (!r.ok || !j.ok) throw new Error(j.description || `Telegram ${r.status}`);
  return j.result ?? [];
}

export async function POST(req: Request) {
  try {
    const secret = req.headers.get('x-cortex-internal-secret');
    if (!process.env.TELEGRAM_INTERNAL_SECRET || secret !== process.env.TELEGRAM_INTERNAL_SECRET) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const bots = await db.telegramBot.findMany({ where: { mode: 'polling', status: { in: ['connected', 'disconnected', 'error'] } } });
    const summary: Array<{ botId: string; updates: number; nextOffset: number }> = [];
    for (const bot of bots) {
      let nextOffset = Math.max(0, bot.lastUpdateId);
      try {
        const token = decryptSecret(bot.tokenEncrypted);
        const updates = await getUpdates(token, nextOffset);
        for (const update of updates) {
          const updateId = Number((update as { update_id?: number }).update_id ?? 0);
          await processTelegramUpdate(bot.id, update);
          if (updateId >= nextOffset) nextOffset = updateId + 1;
        }
        await db.telegramBot.update({ where: { id: bot.id }, data: { lastUpdateId: nextOffset, status: 'connected', lastSeenAt: updates.length ? new Date() : bot.lastSeenAt, lastError: null } });
        summary.push({ botId: bot.id, updates: updates.length, nextOffset });
      } catch (error) {
        await db.telegramBot.update({ where: { id: bot.id }, data: { status: 'error', lastError: error instanceof Error ? error.message : 'poll failed' } }).catch(() => undefined);
        summary.push({ botId: bot.id, updates: 0, nextOffset });
      }
    }
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'poll failed' }, { status: 500 });
  }
}
