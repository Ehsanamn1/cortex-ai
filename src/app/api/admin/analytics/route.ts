import { db } from '@/lib/db';
import { applyCors, jsonOk, toErrorResponse } from '@/lib/server/http';
import { requireSession } from '@/lib/server/auth';
import { agentFilterForSession } from '@/lib/server/access';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const workspaces = session.memberships.map(m => m.workspaceId);
    const agents = await db.agent.findMany({ where: agentFilterForSession(session), select: { id:true, name:true } });
    const agentIds = agents.map(a=>a.id);
    const [users, bots, usage, recentUsage, unanswered] = await Promise.all([
      db.telegramUser.count({ where: { bot: { workspaceId: { in: workspaces } } } }),
      db.telegramBot.count({ where: { workspaceId: { in: workspaces } } }),
      db.usageEvent.aggregate({ where: { workspaceId: { in: workspaces } }, _sum: { totalTokens:true, inputTokens:true, outputTokens:true, estimatedCostMicros:true }, _count:{_all:true} }),
      db.usageEvent.findMany({ where: { workspaceId: { in: workspaces } }, select:{createdAt:true,totalTokens:true,channel:true}, orderBy:{createdAt:'desc'}, take:300 }),
      db.message.findMany({ where:{ conversation:{ agentId:{ in:agentIds } }, role:'assistant' }, select:{content:true,metadata:true}, orderBy:{createdAt:'desc'}, take:3000 })
    ]);
    const recent = new Map<string,{date:string;messages:number;tokens:number}>();
    for (const row of recentUsage) { const date=row.createdAt.toISOString().slice(0,10); const v=recent.get(date)||{date,messages:0,tokens:0}; v.messages+=1; v.tokens+=row.totalTokens; recent.set(date,v); }
    const questions = new Map<string,number>();
    const userMessages = await db.message.findMany({ where:{ conversation:{agentId:{in:agentIds}}, role:'user' }, select:{content:true}, orderBy:{createdAt:'desc'}, take:5000 });
    for (const m of userMessages) { const q=m.content.trim().replace(/\s+/g,' '); if(q) questions.set(q,(questions.get(q)||0)+1); }
    const topQuestions=[...questions.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([question,count])=>({question,count}));
    return applyCors(jsonOk({ users, bots, usage:{events:usage._count._all,tokens:usage._sum.totalTokens??0,inputTokens:usage._sum.inputTokens??0,outputTokens:usage._sum.outputTokens??0,estimatedCostMicros:usage._sum.estimatedCostMicros??0}, trend:[...recent.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-14), topQuestions, note:'پرسش‌های پرتکرار از پیام‌های واقعی کاربران محاسبه شده‌اند.' }), req.headers.get('origin'));
  } catch(e){ return toErrorResponse(e); }
}
