import { db } from '@/lib/db';
import { estimateTokens } from './audit';

export async function assertUsageWithinLimits(workspaceId: string, incomingMessages = 1, incomingTokens = 0) {
  const policy = await db.usagePolicy.findUnique({ where: { workspaceId } });
  if (!policy) return;
  const now = new Date();
  const day = new Date(now); day.setHours(0,0,0,0);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const [daily, monthly] = await Promise.all([
    db.usageEvent.aggregate({ where:{workspaceId, createdAt:{gte:day}}, _sum:{totalTokens:true}, _count:{_all:true} }),
    db.usageEvent.aggregate({ where:{workspaceId, createdAt:{gte:month}}, _sum:{totalTokens:true}, _count:{_all:true} }),
  ]);
  if (policy.dailyMessageLimit > 0 && (daily._count._all + incomingMessages) > policy.dailyMessageLimit) throw Object.assign(new Error('سقف پیام روزانه این فضای کاری پر شده است.'), { status: 429 });
  if (policy.monthlyMessageLimit > 0 && (monthly._count._all + incomingMessages) > policy.monthlyMessageLimit) throw Object.assign(new Error('سقف پیام ماهانه این فضای کاری پر شده است.'), { status: 429 });
  if (policy.dailyTokenLimit > 0 && ((daily._sum.totalTokens ?? 0) + incomingTokens) > policy.dailyTokenLimit) throw Object.assign(new Error('سقف توکن روزانه این فضای کاری پر شده است.'), { status: 429 });
  if (policy.monthlyTokenLimit > 0 && ((monthly._sum.totalTokens ?? 0) + incomingTokens) > policy.monthlyTokenLimit) throw Object.assign(new Error('سقف توکن ماهانه این فضای کاری پر شده است.'), { status: 429 });
}

export function tokenEstimateForMessages(messages: Array<{content:string}>): number { return messages.reduce((sum,m)=>sum+estimateTokens(m.content),0); }
