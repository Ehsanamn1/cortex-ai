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

    // Acknowledge the webhook quickly, then process the update in the Worker
    // background. The DB ledger prevents duplicate delivery from generating a
    // second user message / model call.
    after(async () => {
      let lastError: unknown = null;
      let ledgerId: string | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (Number.isInteger(updateId)) {
            const existing = await db.telegramProcessedUpdate.findUnique({
              where: { botId_updateId: { botId: bot.id, updateId } },
            });

            if (existing?.status === "completed") return;
            if (existing?.status === "processing" && existing.updatedAt.getTime() > Date.now() - 120_000) return;

            if (existing) {
              const claimed = await db.telegramProcessedUpdate.update({
                where: { id: existing.id },
                data: { status: "processing", attempts: { increment: 1 }, lastError: null },
              });
              ledgerId = claimed.id;
            } else {
              const created = await db.telegramProcessedUpdate.create({
                data: { botId: bot.id, updateId, status: "processing", attempts: 1 },
              });
              ledgerId = created.id;
            }
          }

          await processTelegramUpdate(bot.id, update);

          if (ledgerId) {
            await db.telegramProcessedUpdate.update({
              where: { id: ledgerId },
              data: { status: "completed", completedAt: new Date(), lastError: null },
            });
          }

          if (Number.isInteger(updateId)) {
            await db.telegramBot.updateMany({
              where: { id: bot.id, lastUpdateId: { lt: updateId } },
              data: { lastUpdateId: updateId },
            });
          }
          return;
        } catch (error) {
          lastError = error;
          if (ledgerId) {
            await db.telegramProcessedUpdate.update({
              where: { id: ledgerId },
              data: { status: attempt === 2 ? "failed" : "processing", lastError: error instanceof Error ? error.message.slice(0, 500) : "unknown error" },
            }).catch(() => undefined);
          }
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
