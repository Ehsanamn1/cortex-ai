import { db } from '@/lib/db';
import { applyCors, jsonOk, toErrorResponse } from '@/lib/server/http';
import { requireSession, assertWorkspaceAccess } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const workspaceId = new URL(req.url).searchParams.get('workspaceId') || session.memberships[0]?.workspaceId;
    if (!workspaceId) throw Object.assign(new Error('فضای کاری یافت نشد.'), { status: 400 });
    assertWorkspaceAccess(session, workspaceId);
    const agents = await db.agent.findMany({ where: { workspaceId }, select: { id:true, name:true } });
    const agentIds = agents.map(a=>a.id);
    const [users, bots, usage, recentUsage, unanswered] = await Promise.all([
      db.telegramUser.count({ where: { bot: { workspaceId } } }),
      db.telegramBot.count({ where: { workspaceId } }),
      db.usageEvent.aggregate({ where: { workspaceId }, _sum: { totalTokens:true, inputTokens:true, outputTokens:true, estimatedCostMicros:true }, _count:{_all:true} }),
      db.usageEvent.findMany({ where: { workspaceId }, select:{createdAt:true,totalTokens:true,channel:true}, orderBy:{createdAt:'desc'}, take:300 }),
      db.message.findMany({ where:{ conversation:{ agentId:{ in:agentIds } }, role:'assistant' }, select:{conversationId:true,content:true,metadata:true}, orderBy:{createdAt:'desc'}, take:3000 })
    ]);
    const recent = new Map<string,{date:string;messages:number;tokens:number}>();
    for (const row of recentUsage) { const date=row.createdAt.toISOString().slice(0,10); const v=recent.get(date)||{date,messages:0,tokens:0}; v.messages+=1; v.tokens+=row.totalTokens; recent.set(date,v); }
    const questions = new Map<string,number>();
    const userMessages = await db.message.findMany({ where:{ conversation:{agentId:{in:agentIds}}, role:'user' }, select:{conversationId: true, content:true, createdAt:true}, orderBy:{createdAt:'desc'}, take:5000 });
    for (const m of userMessages) { const q=m.content.trim().replace(/\s+/g,' '); if(q) questions.set(q,(questions.get(q)||0)+1); }
    const topQuestions=[...questions.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([question,count])=>({question,count}));

    const fallbackMarker='اطلاعات کافی در دانش فعلی برای پاسخ دقیق به این سؤال پیدا نکردم.';
    const unansweredCounts=new Map<string,number>();
    const latestUserByConversation=new Map<string,string>();
    for(const row of userMessages){ if(!latestUserByConversation.has(row.conversationId)) latestUserByConversation.set(row.conversationId,row.content.trim().replace(/\s+/g,' ')); }
    for(const message of unanswered){
      if(typeof message.content!=='string' || !message.content.includes(fallbackMarker)) continue;
      const question=latestUserByConversation.get((message as {conversationId?:string}).conversationId ?? '') || 'سؤال بدون پاسخ متکی به دانش کافی';
      unansweredCounts.set(question,(unansweredCounts.get(question)||0)+1);
    }
    const unansweredQuestions=[...unansweredCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([question,count])=>({question,count}));
    const unansweredCount=[...unansweredCounts.values()].reduce((sum,count)=>sum+count,0);

    return applyCors(jsonOk({ users, bots, usage:{events:usage._count._all,tokens:usage._sum.totalTokens??0,inputTokens:usage._sum.inputTokens??0,outputTokens:usage._sum.outputTokens??0,estimatedCostMicros:usage._sum.estimatedCostMicros??0}, trend:[...recent.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-14), topQuestions, unanswered:unansweredCount, unansweredQuestions, note:'پرسش‌های پرتکرار و موارد بدون پاسخ کافی از داده‌های واقعی گفتگوها محاسبه شده‌اند.' }), req.headers.get('origin'));
  } catch(e){ return toErrorResponse(e); }
}
