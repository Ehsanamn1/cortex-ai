import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
import { runAgentExecution } from "@/lib/runtime/engine";
import { estimateTokens } from "@/lib/server/audit";
import { releaseBillingReservation, reserveBillingForAgentRequest, recordUsageAndCharge } from "@/lib/server/billing";
export const dynamic="force-dynamic";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  let billingReservationId: string | null = null;
  try{const s=await requireSession(req);const {id}=await params;const wf=await db.workflow.findUnique({where:{id}});if(!wf)return applyCors(jsonError("Workflow پیدا نشد.",404),req.headers.get("origin"));assertWorkspaceAccess(s,wf.workspaceId);if(!wf.agentId)return applyCors(jsonError("برای اجرای Workflow باید یک Agent متصل باشد.",400),req.headers.get("origin"));
const agent=await db.agent.findFirst({where:{id:wf.agentId,workspaceId:wf.workspaceId},select:{id:true,maxTokens:true}});
if(!agent)return applyCors(jsonError("ایجنت متصل به Workflow پیدا نشد.",404),req.headers.get("origin"));const b=await readJson<{input?:unknown}>(req);const input=typeof b.input==="string"?b.input.trim():"";if(!input)return applyCors(jsonError("input الزامی است.",400),req.headers.get("origin"));billingReservationId=(await reserveBillingForAgentRequest({
  workspaceId:wf.workspaceId,
  agentId:wf.agentId,
  inputTokens:estimateTokens(input),
  maxOutputTokens:agent.maxTokens,
})).reservationId;
const result=await runAgentExecution({workspaceId:wf.workspaceId,agentId:wf.agentId,input,history:[]});
await recordUsageAndCharge({
  usage:{
    workspaceId:wf.workspaceId,
    agentId:wf.agentId,
    channel:"workflow",
    provider:result.provider,
    model:result.model,
    inputTokens:estimateTokens(input)+(result.auxiliaryInputTokens??0),
    outputTokens:estimateTokens(result.content)+(result.auxiliaryOutputTokens??0),
  },
  reservationId:billingReservationId,
});
billingReservationId=null;await db.execution.update({where:{id:result.executionId},data:{workflowId:wf.id,triggerType:"manual-workflow"}});return applyCors(jsonOk(result),req.headers.get("origin"));}catch(e){
  await releaseBillingReservation(billingReservationId);
  billingReservationId=null;
  return toErrorResponse(e,req.headers.get("origin"));
}}
