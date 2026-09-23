import { db } from '@/lib/db';
import { decryptSecret } from '@/lib/server/secrets';
import { estimateTokens } from '@/lib/server/audit';
import { assertUsageWithinLimits } from '@/lib/server/usage';
import { audit } from '@/lib/server/audit';
import { answerWithKnowledge, toRetrievalDebug, toSourceRefs } from '@/lib/rag/pipeline';

const API = 'https://api.telegram.org';

class TelegramApiError extends Error {
  retryable: boolean;
  retryAfterMs: number;
  constructor(message: string, retryable: boolean, retryAfterMs = 0) {
    super(message);
    this.name = "TelegramApiError";
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

const normalizePhone=(v:string)=>{ const digits=v.replace(/\D/g,''); if(!digits) return ''; return '+' + (digits.startsWith('00')?digits.slice(2):digits); };

async function telegramCall(token:string, method:string, body:Record<string,unknown>){
  let lastError: Error | null = null;
  for(let attempt=0; attempt<3; attempt++){
    try{
      const res=await fetch(API + '/bot' + token + '/' + method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20_000)});
      const data=await res.json() as {ok?:boolean;result?:any;description?:string;parameters?:{retry_after?:number}};
      if(res.ok && data.ok) return data.result;
      const retryAfter=Number(data.parameters?.retry_after ?? 0);
      const retryable=res.status===429 || res.status>=500;
      const error=new TelegramApiError(data.description||('Telegram API ' + res.status),retryable,retryAfter*1000);
      if(!retryable || attempt===2) throw error;
      const delay=Math.min(8000,Math.max(500,error.retryAfterMs||750*(attempt+1)));
      await new Promise(resolve=>setTimeout(resolve,delay));
    }catch(error){
      lastError=error instanceof Error?error:new Error(String(error));
      if(error instanceof TelegramApiError){
        if(!error.retryable || attempt===2) throw error;
        const delay=Math.min(8000,Math.max(500,error.retryAfterMs||750*(attempt+1)));
        await new Promise(resolve=>setTimeout(resolve,delay));
        continue;
      }
      if(attempt===2) throw lastError;
      await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
    }
  }
  throw lastError??new Error('Telegram API unavailable');
}
export async function getBotInfo(token:string){ return telegramCall(token,'getMe',{}); }
export async function setWebhook(token:string,url:string,secret:string){ return telegramCall(token,'setWebhook',{url,secret_token:secret,allowed_updates:['message']}); }
export async function deleteWebhook(token:string){ return telegramCall(token,'deleteWebhook',{drop_pending_updates:false}); }
export async function sendMessage(token:string,chatId:string|number,text:string){
  const value=text.trim();
  const chunks:string[]=[];
  for(let i=0;i<value.length;i+=4096) chunks.push(value.slice(i,i+4096));
  const results: unknown[]=[];
  for(const chunk of chunks.length?chunks:['']) results.push(await telegramCall(token,'sendMessage',{chat_id:chatId,text:chunk,disable_web_page_preview:true}));
  return results.at(-1);
}
export async function requestContact(token:string,chatId:string|number){ return telegramCall(token,'sendMessage',{chat_id:chatId,text:'برای شناسایی و بررسی دسترسی، شماره موبایل خود را از طریق دکمه زیر ارسال کنید.',reply_markup:{keyboard:[[{text:'📱 ارسال شماره موبایل',request_contact:true}]],resize_keyboard:true,one_time_keyboard:true}}); }
export async function processTelegramUpdate(botId:string, update:any){
  const bot=await db.telegramBot.findUnique({where:{id:botId}}); if(!bot) return;
  const token=decryptSecret(bot.tokenEncrypted);
  const msg=update?.message; if(!msg) return;
  const tgId=String(msg.from?.id ?? msg.chat?.id ?? ''); if(!tgId) return;
  const user=await db.telegramUser.upsert({where:{botId_telegramUserId:{botId,telegramUserId:tgId}},update:{username:msg.from?.username??undefined,firstName:msg.from?.first_name??undefined,lastName:msg.from?.last_name??undefined,lastSeenAt:new Date()},create:{botId,telegramUserId:tgId,username:msg.from?.username??null,firstName:msg.from?.first_name??null,lastName:msg.from?.last_name??null,lastSeenAt:new Date()}});
  const contactPhone=msg.contact?.phone_number ? normalizePhone(msg.contact.phone_number) : '';
  if(contactPhone){
    const sharedUserId = msg.contact?.user_id != null ? String(msg.contact.user_id) : '';
    if(sharedUserId && sharedUserId !== tgId){
      await db.telegramUser.update({where:{id:user.id},data:{phoneNumber:contactPhone,status:'blocked'}});
      await audit({workspaceId:bot.workspaceId,userId:null,action:'telegram.contact_rejected',entityType:'TelegramUser',entityId:user.id,metadata:{reason:'contact_user_mismatch'}});
      await sendMessage(token,msg.chat.id,'این شماره متعلق به حساب تلگرام شما نیست. لطفاً شماره خودتان را ارسال کنید.');
      return;
    }
    const allowed=await db.telegramAllowlistEntry.findUnique({where:{botId_phoneNumber:{botId,phoneNumber:contactPhone}}});
    const nextStatus = allowed?.status === 'allowed' ? 'allowed' : 'blocked';
    await db.telegramUser.update({where:{id:user.id},data:{phoneNumber:contactPhone,status:nextStatus}});
    await audit({workspaceId:bot.workspaceId,userId:null,action:`telegram.user_${nextStatus}`,entityType:'TelegramUser',entityId:user.id,metadata:{phoneNumber:contactPhone}});
    if(nextStatus==='allowed') await sendMessage(token,msg.chat.id,'شماره شما تأیید شد. حالا می‌توانید سؤال خود را ارسال کنید.');
    else await sendMessage(token,msg.chat.id,'این شماره در فهرست دسترسی ربات ثبت نشده است. لطفاً با مدیر سامانه تماس بگیرید.');
    return;
  }
  if(user.status==='blocked'){
    if(msg.chat?.id) await sendMessage(token,msg.chat.id,'دسترسی این شماره به ربات مسدود شده است. برای فعال‌سازی با مدیر سامانه تماس بگیرید.');
    return;
  }
  if(msg.text==='/start' || msg.text==='/newchat'){
    if(user.status!=='allowed') return requestContact(token,msg.chat.id);
    if(msg.text==='/newchat'){
      await db.conversation.create({data:{agentId:bot.agentId,userId:null,title:'گفتگوی جدید',channel:'telegram',externalUserId:tgId,telegramBotId:bot.id}});
      await sendMessage(token,msg.chat.id,'گفتگوی جدید ایجاد شد. سؤال بعدی را بفرستید.');
    }
    return;
  }
  if(typeof msg.text!=='string' || !msg.text.trim()) return;
  if(user.status!=='allowed') return requestContact(token,msg.chat.id);
  await assertUsageWithinLimits(bot.workspaceId, 1, estimateTokens(msg.text), user.id);
  let conversation=await db.conversation.findFirst({where:{agentId:bot.agentId,telegramBotId:bot.id,externalUserId:tgId,channel:'telegram'},orderBy:{updatedAt:'desc'}});
  if(!conversation) conversation=await db.conversation.create({data:{agentId:bot.agentId,userId:null,title:'گفتگوی تلگرام',channel:'telegram',externalUserId:tgId,telegramBotId:bot.id}});
  const history=await db.message.findMany({where:{conversationId:conversation.id},orderBy:{createdAt:'asc'},take:24});
  const userMsg=await db.message.create({data:{conversationId:conversation.id,role:'user',content:msg.text.trim()}});
  const answer=await answerWithKnowledge({agentId:bot.agentId,workspaceId:bot.workspaceId,persona:(await db.agent.findUniqueOrThrow({where:{id:bot.agentId}})),history:history.filter(m=>m.role==='user'||m.role==='assistant').slice(-12).map(m=>({role:m.role as 'user'|'assistant',content:m.content})),question:msg.text.trim()});
  const metadata={sources:toSourceRefs(answer.retrieval),retrieval:toRetrievalDebug(answer.retrieval),provider:answer.provider,model:answer.model,latencyMs:answer.latencyMs};
  await db.message.create({data:{conversationId:conversation.id,role:'assistant',content:answer.content,metadata:JSON.stringify(metadata)}});
  await db.conversation.update({where:{id:conversation.id},data:{updatedAt:new Date()}});
  const inputTokens=estimateTokens(msg.text)+history.reduce((n,m)=>n+estimateTokens(m.content),0), outputTokens=estimateTokens(answer.content);
  await db.usageEvent.create({data:{workspaceId:bot.workspaceId,agentId:bot.agentId,telegramBotId:bot.id,telegramUserId:user.id,channel:'telegram',provider:answer.provider,model:answer.model,inputTokens,outputTokens,totalTokens:inputTokens+outputTokens}});
  await db.telegramBot.update({where:{id:bot.id},data:{status:'connected',lastSeenAt:new Date(),lastError:null}});
  await sendMessage(token,msg.chat.id,answer.content);
}
