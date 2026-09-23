import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { estimateTokens } from "@/lib/server/audit";
import { assertUsageWithinLimits } from "@/lib/server/usage";
import { authenticateAgentApiKey, readAgentApiKey } from "@/lib/server/agent-api-key";
import { answerWithKnowledge, toRetrievalDebug, toSourceRefs, RagConfigError } from "@/lib/rag/pipeline";

export const dynamic="force-dynamic";
export const maxDuration=120;

export async function POST(req:Request){
  try{
    const key=readAgentApiKey(req); if(!key)return applyCors(jsonError("API Key ارسال نشده است.",401),req.headers.get("origin"));
    const auth=await authenticateAgentApiKey(key); if(!auth)return applyCors(jsonError("API Key نامعتبر یا غیرفعال است.",401),req.headers.get("origin"));
    rateLimit(req,"openai-agent-api-"+auth.id,60,60_000);
    const body=await readJson<Record<string,unknown>>(req);
    const messages=Array.isArray(body.messages)?body.messages.filter((m):m is Record<string,unknown>=>!!m&&typeof m==="object"):[];
    const last=messages.filter(m=>m.role==="user"&&typeof m.content==="string").at(-1)?.content as string|undefined;
    if(!last?.trim())return applyCors(jsonError("حداقل یک پیام با role=user لازم است.",400),req.headers.get("origin"));
    const clientId=(req.headers.get("x-cortex-client-id")||"openai-client").slice(0,120);
    const conversationId=req.headers.get("x-cortex-conversation-id")||"";
    let conversation=conversationId?await db.conversation.findFirst({where:{id:conversationId,agentId:auth.agentId,channel:"api",externalUserId:clientId}}):null;
    if(!conversation)conversation=await db.conversation.findFirst({where:{agentId:auth.agentId,channel:"api",externalUserId:clientId},orderBy:{updatedAt:"desc"}});
    if(!conversation)conversation=await db.conversation.create({data:{agentId:auth.agentId,userId:null,title:"گفتگوی API",channel:"api",externalUserId:clientId}});
    const existing=await db.message.findMany({where:{conversationId:conversation.id,role:{in:["user","assistant"]}},orderBy:{createdAt:"asc"},take:24});
    await assertUsageWithinLimits(auth.workspaceId,1,estimateTokens(last));
    const answer=await answerWithKnowledge({agentId:auth.agentId,workspaceId:auth.workspaceId,persona:auth.agent,history:existing.slice(-12).map(m=>({role:m.role as "user"|"assistant",content:m.content})),question:last.trim()});
    const metadata={sources:toSourceRefs(answer.retrieval),retrieval:toRetrievalDebug(answer.retrieval),provider:answer.provider,model:answer.model,latencyMs:answer.latencyMs};
    await db.message.create({data:{conversationId:conversation.id,role:"user",content:last.trim()}});
    const assistant=await db.message.create({data:{conversationId:conversation.id,role:"assistant",content:answer.content,metadata:JSON.stringify(metadata)}});
    await db.conversation.update({where:{id:conversation.id},data:{updatedAt:new Date()}});
    const inputTokens=estimateTokens(last); const outputTokens=estimateTokens(answer.content); const totalTokens=inputTokens+outputTokens;
    await db.usageEvent.create({data:{workspaceId:auth.workspaceId,agentId:auth.agentId,channel:"api",provider:answer.provider,model:answer.model,inputTokens,outputTokens,totalTokens}});
    return applyCors(jsonOk({id:"chatcmpl-"+assistant.id,object:"chat.completion",created:Math.floor(Date.now()/1000),model:auth.agent.id,choices:[{index:0,message:{role:"assistant",content:answer.content},finish_reason:"stop"}],usage:{prompt_tokens:inputTokens,completion_tokens:outputTokens,total_tokens:totalTokens},x_cortex:{conversationId:conversation.id,sources:metadata.sources}}),req.headers.get("origin"));
  }catch(e){
    if(e instanceof RagConfigError)return applyCors(jsonError(e.message,503),req.headers.get("origin"));
    return toErrorResponse(e);
  }
}
