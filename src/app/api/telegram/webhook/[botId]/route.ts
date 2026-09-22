import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decryptSecret } from '@/lib/server/secrets';
import { processTelegramUpdate } from '@/lib/telegram/service';
export const dynamic='force-dynamic';
export const maxDuration=120;
type Params={params:Promise<{botId:string}>};
export async function POST(req:Request,{params}:Params){try{const bot=await db.telegramBot.findUnique({where:{id:(await params).botId}});if(!bot)return NextResponse.json({ok:false},{status:404});const expected=bot.webhookSecretEncrypted?decryptSecret(bot.webhookSecretEncrypted):null;const provided=req.headers.get('x-telegram-bot-api-secret-token');if(expected&&provided!==expected)return NextResponse.json({ok:false},{status:403});const update=await req.json();await processTelegramUpdate(bot.id,update);return NextResponse.json({ok:true});}catch(e){console.error('[cortex][telegram-webhook]',e);return NextResponse.json({ok:false},{status:200});}}
