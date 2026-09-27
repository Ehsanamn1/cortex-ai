import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { assertWorkspaceAccess } from "@/lib/server/auth";
import { runAgentExecution } from "@/lib/runtime/engine";
import { estimateTokens } from "@/lib/server/audit";
import { releaseBillingReservation, reserveBillingForAgentRequest, recordUsageAndCharge } from "@/lib/server/billing";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{const session=await requireSession(req);const u=new URL(req.url);const workspaceId=u.searchParams.get("workspaceId")||session.memberships[0]?.workspaceId;if(!workspaceId)return applyCors(jsonError("فضای کاری پیدا نشد.",404),u.origin);assertWorkspaceAccess(session,workspaceId);const limit=Math.min(100,Math.max(1,Number(u.searchParams.get("limit")||30)));const agentId=u.searchParams.get("agentId");const rows=await db.execution.findMany({where:{workspaceId,...(agentId?{agentId}: {})},orderBy:{startedAt:"desc"},take:limit,include:{agent:{select:{id:true,name:true}},workflow:{select:{id:true,name:true}},steps:{orderBy:{seq:"asc"}}}});return applyCors(jsonOk({executions:rows}),u.origin);}catch(e){return toErrorResponse(e,req.headers.get("origin"));}}
export async function POST(req:Request){
  let billingReservationId: string | null = null;
  try{const session=await requireSession(req);const body=await readJson<{workspaceId?:unknown;agentId?:unknown;input?:unknown;conversationId?:unknown}>(req);const workspaceId=typeof body.workspaceId==="string"?body.workspaceId:session.memberships[0]?.workspaceId;const agentId=typeof body.agentId==="string"?body.agentId:"";const input=typeof body.input==="string"?body.input.trim():"";if(!workspaceId||!agentId||!input)return applyCors(jsonError("workspaceId، agentId و input الزامی هستند.",400),req.headers.get("origin"));assertWorkspaceAccess(session,workspaceId);
    const agent = await db.agent.findFirst({ where: { id: agentId, workspaceId }, select: { id:true, maxTokens:true } });
    if (!agent) return applyCors(jsonError("ایجنت برای این فضای کاری پیدا نشد.",404),req.headers.get("origin"));
    billingReservationId = (await reserveBillingForAgentRequest({
      workspaceId,
      agentId,
      inputTokens: estimateTokens(input),
      maxOutputTokens: agent.maxTokens,
    })).reservationId;
    const result=await runAgentExecution({workspaceId,agentId,input,conversationId:typeof body.conversationId==="string"?body.conversationId:undefined,history:[]});
    await recordUsageAndCharge({
      usage:{
        workspaceId,
        agentId,
        channel:"execution",
        provider:result.provider ?? "unknown",
        model:result.model ?? "unknown",
        inputTokens:estimateTokens(input)+(result.auxiliaryInputTokens??0),
        outputTokens:estimateTokens(result.content)+(result.auxiliaryOutputTokens??0),
      },
      reservationId:billingReservationId,
    });
    billingReservationId=null;
    return applyCors(jsonOk(result),req.headers.get("origin"));
  }catch(e){
    await releaseBillingReservation(billingReservationId);
    billingReservationId=null;
    return toErrorResponse(e,req.headers.get("origin"));
  }
}
