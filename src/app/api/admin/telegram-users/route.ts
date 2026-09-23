import { db } from '@/lib/db';
import { applyCors, jsonOk, jsonError, readJson, toErrorResponse } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/admin-auth';
import { normalizeTelegramPhone } from '@/lib/telegram/phone';

export const dynamic='force-dynamic';

function safeLimit(value:unknown){const n=Number(value);return Number.isFinite(n)&&n>=0?Math.min(10_000_000,Math.floor(n)):undefined;}
function startOfDay(){const d=new Date();d.setHours(0,0,0,0);return d;}
function startOfMonth(){const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1);}

export async function GET(req:Request){
  try{
    requireAdmin(req);
    const workspaceId=new URL(req.url).searchParams.get('workspaceId');
    const botWhere=workspaceId?{workspaceId}:{};
    const users=await db.telegramUser.findMany({
      where:{bot:botWhere},
      include:{bot:{select:{id:true,name:true,workspaceId:true,username:true}}},
      orderBy:[{status:'asc'},{lastSeenAt:'desc'}],
    });
    const ids=users.map(u=>u.id);
    const [total,daily,monthly,allowlist]=await Promise.all([
      db.usageEvent.groupBy({by:['telegramUserId'],where:{telegramUserId:{in:ids}},_sum:{totalTokens:true,inputTokens:true,outputTokens:true,estimatedCostMicros:true},_count:{_all:true},_max:{createdAt:true}}),
      db.usageEvent.groupBy({by:['telegramUserId'],where:{telegramUserId:{in:ids},createdAt:{gte:startOfDay()}},_sum:{totalTokens:true},_count:{_all:true}}),
      db.usageEvent.groupBy({by:['telegramUserId'],where:{telegramUserId:{in:ids},createdAt:{gte:startOfMonth()}},_sum:{totalTokens:true},_count:{_all:true}}),
      db.telegramAllowlistEntry.findMany({where:{bot:botWhere},include:{bot:{select:{id:true,name:true,username:true}}},orderBy:{createdAt:'desc'}}),
    ]);
    const tm=new Map(total.map(x=>[x.telegramUserId,{events:x._count._all,tokens:x._sum.totalTokens??0,inputTokens:x._sum.inputTokens??0,outputTokens:x._sum.outputTokens??0,estimatedCostMicros:x._sum.estimatedCostMicros??0,lastUsedAt:x._max.createdAt?.toISOString()??null}]));
    const dm=new Map(daily.map(x=>[x.telegramUserId,{events:x._count._all,tokens:x._sum.totalTokens??0}]));
    const mm=new Map(monthly.map(x=>[x.telegramUserId,{events:x._count._all,tokens:x._sum.totalTokens??0}]));
    return applyCors(jsonOk({
      users:users.map(u=>({...u,lastSeenAt:u.lastSeenAt?.toISOString()??null,createdAt:u.createdAt.toISOString(),updatedAt:u.updatedAt.toISOString(),usage:tm.get(u.id)??{events:0,tokens:0,inputTokens:0,outputTokens:0,estimatedCostMicros:0,lastUsedAt:null},dailyUsage:dm.get(u.id)??{events:0,tokens:0},monthlyUsage:mm.get(u.id)??{events:0,tokens:0}})),
      allowlist:allowlist.map(e=>({...e,createdAt:e.createdAt.toISOString(),updatedAt:e.updatedAt.toISOString()})),
    }),req.headers.get('origin'));
  }catch(e){return toErrorResponse(e);}
}

export async function POST(req:Request){
  try{
    requireAdmin(req);
    const b=await readJson<Record<string,unknown>>(req);
    const botId=typeof b.botId==='string'?b.botId:'';
    const phone=normalizeTelegramPhone(typeof b.phoneNumber==='string'?b.phoneNumber:'');
    if(!botId||phone.length<8)return applyCors(jsonError('ربات و شماره موبایل معتبر لازم است.',400),req.headers.get('origin'));
    const bot=await db.telegramBot.findUnique({where:{id:botId}});
    if(!bot)return applyCors(jsonError('ربات تلگرام یافت نشد.',404),req.headers.get('origin'));
    const entry=await db.telegramAllowlistEntry.upsert({
      where:{botId_phoneNumber:{botId,phoneNumber:phone}},
      update:{displayName:typeof b.displayName==='string'?b.displayName.trim().slice(0,80):null,notes:typeof b.notes==='string'?b.notes.trim().slice(0,300):null,status:'allowed'},
      create:{botId,phoneNumber:phone,displayName:typeof b.displayName==='string'?b.displayName.trim().slice(0,80):null,notes:typeof b.notes==='string'?b.notes.trim().slice(0,300):null,status:'allowed'},
      include:{bot:{select:{id:true,name:true,username:true}}},
    });
    await db.telegramUser.updateMany({where:{botId,phoneNumber:phone},data:{status:'allowed'}});
    return applyCors(jsonOk({entry},201),req.headers.get('origin'));
  }catch(e){return toErrorResponse(e);}
}

export async function PATCH(req:Request){
  try{
    requireAdmin(req);
    const b=await readJson<Record<string,unknown>>(req);
    const id=typeof b.id==='string'?b.id:'';
    if(!id)return applyCors(jsonError('شناسه کاربر لازم است.',400),req.headers.get('origin'));
    const existing=await db.telegramUser.findUnique({where:{id}});
    if(!existing)return applyCors(jsonError('کاربر تلگرام یافت نشد.',404),req.headers.get('origin'));
    const data:any={};
    if(typeof b.status==='string'&&['pending','allowed','blocked'].includes(b.status))data.status=b.status;
    for(const key of ['dailyMessageLimit','monthlyMessageLimit','dailyTokenLimit','monthlyTokenLimit']){const v=safeLimit(b[key]);if(v!==undefined)data[key]=v;}
    if(!Object.keys(data).length)return applyCors(jsonError('هیچ تغییر معتبری ارسال نشده است.',400),req.headers.get('origin'));
    const user=await db.telegramUser.update({where:{id},data,include:{bot:{select:{id:true,name:true,workspaceId:true,username:true}}}});
    return applyCors(jsonOk({user}),req.headers.get('origin'));
  }catch(e){return toErrorResponse(e);}
}

export async function DELETE(req:Request){
  try{
    requireAdmin(req);
    const id=new URL(req.url).searchParams.get('id')||'';
    if(!id)return applyCors(jsonError('شناسه دسترسی لازم است.',400),req.headers.get('origin'));
    const entry=await db.telegramAllowlistEntry.findUnique({where:{id}});
    if(!entry)return applyCors(jsonError('رکورد دسترسی یافت نشد.',404),req.headers.get('origin'));
    await db.telegramAllowlistEntry.delete({where:{id}});
    await db.telegramUser.updateMany({where:{botId:entry.botId,phoneNumber:entry.phoneNumber},data:{status:'blocked'}});
    return applyCors(jsonOk({ok:true}),req.headers.get('origin'));
  }catch(e){return toErrorResponse(e);}
}
