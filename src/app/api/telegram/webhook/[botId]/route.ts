import { after, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decryptSecret } from '@/lib/server/secrets';
import { processTelegramUpdate } from '@/lib/telegram/service';
export const dynamic='force-dynamic';
export const maxDuration=120;
type Params={params:Promise<{botId:string}>};
export async function POST(req:Request,{params}:Params){
  try{
    const bot=await db.telegramBot.findUnique({where:{id:(await params).botId}});
    if(!bot)return NextResponse.json({ok:false},{status:404});

    const expected=bot.webhookSecretEncrypted?decryptSecret(bot.webhookSecretEncrypted):null;
    const provided=req.headers.get('x-telegram-bot-api-secret-token');
    if(!expected || !provided || provided!==expected)return NextResponse.json({ok:false},{status:403});

    const update = (await req.json()) as Record<string, unknown>;
    const updateId = Number(update?.update_id);

    // Telegram retries webhook delivery only when the webhook returns a
    // non-2xx response. We intentionally acknowledge immediately, so failures
    // in the background handler need their own bounded retry loop. The
    // lastUpdateId marker is advanced only after successful processing.
    after(async () => {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (Number.isInteger(updateId)) {
            const current = await db.telegramBot.findUnique({
              where: { id: bot.id },
              select: { lastUpdateId: true },
            });
            if (current && updateId <= current.lastUpdateId) return;
          }

          await processTelegramUpdate(bot.id, update);

          if (Number.isInteger(updateId)) {
            await db.telegramBot.updateMany({
              where: { id: bot.id, lastUpdateId: { lt: updateId } },
              data: { lastUpdateId: updateId },
            });
          }
          return;
        } catch (error) {
          lastError = error;
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
          }
        }
      }
      console.error('[cortex][telegram-webhook] background processing failed after retries:', lastError);
    });
    return NextResponse.json({ ok: true });
  }catch(e){
    console.error('[cortex][telegram-webhook]',e);
    return NextResponse.json({ok:false,error:'webhook processing failed'},{status:500});
  }
}
