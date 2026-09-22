import { db } from '@/lib/db';
import { applyCors, jsonOk, toErrorResponse } from '@/lib/server/http';
import { requireSession, assertWorkspaceAccess } from '@/lib/server/auth';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const s=await requireSession(req);const workspaceId=new URL(req.url).searchParams.get('workspaceId')||s.memberships[0]?.workspaceId;if(!workspaceId)throw Object.assign(new Error('فضای کاری یافت نشد.'),{status:400});const role=assertWorkspaceAccess(s,workspaceId); if(!['owner','admin'].includes(role.role)) throw Object.assign(new Error('دسترسی مدیر لازم است.'),{status:403});const [bots,users,agents,knowledge,conversations,events,logs]=await Promise.all([
 db.telegramBot.findMany({where:{workspaceId},include:{agent:{select:{name:true}},_count:{select:{users:true,allowlist:true}}},orderBy:{createdAt:'desc'}}),
 db.telegramUser.findMany({where:{bot:{workspaceId}},include:{bot:{select:{name:true}}},orderBy:{lastSeenAt:'desc'},take:100}),
 db.agent.findMany({where:{workspaceId},select:{id:true,name:true,status:true,createdAt:true,updatedAt:true},orderBy:{updatedAt:'desc'}}),
 db.knowledgeSource.findMany({where:{agent:{workspaceId}},select:{id:true,name:true,status:true,error:true,updatedAt:true},orderBy:{updatedAt:'desc'},take:100}),
 db.conversation.findMany({where:{agent:{workspaceId}},select:{id:true,title:true,channel:true,updatedAt:true,agent:{select:{name:true}}},orderBy:{updatedAt:'desc'},take:100}),
 db.usageEvent.findMany({where:{workspaceId},select:{id:true,channel:true,provider:true,model:true,totalTokens:true,createdAt:true,agent:{select:{name:true}}},orderBy:{createdAt:'desc'},take:100}),
 db.auditLog.findMany({where:{workspaceId},select:{id:true,action:true,entityType:true,entityId:true,createdAt:true},orderBy:{createdAt:'desc'},take:100})
]);
const telegramUserIds=users.map((u:any)=>u.id);
const usageRows=telegramUserIds.length?await db.usageEvent.groupBy({by:['telegramUserId'],where:{workspaceId,telegramUserId:{in:telegramUserIds}},_sum:{totalTokens:true,inputTokens:true,outputTokens:true},_count:{_all:true}}):[];
const usageMap=new Map(usageRows.map((row:any)=>[row.telegramUserId,{events:row._count._all,tokens:row._sum.totalTokens??0,inputTokens:row._sum.inputTokens??0,outputTokens:row._sum.outputTokens??0}]));
const usersWithUsage=users.map((u:any)=>({...u,usage:usageMap.get(u.id)||{events:0,tokens:0,inputTokens:0,outputTokens:0}}));return applyCors(jsonOk({role:role.role,bots,users:usersWithUsage,agents,knowledge,conversations,events,logs}),req.headers.get('origin'));}catch(e){return toErrorResponse(e)}}
