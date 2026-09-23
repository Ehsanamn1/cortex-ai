import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { loadAgentForSession } from "@/lib/server/access";
import { generateAgentApiKey, hashAgentApiKey } from "@/lib/server/agent-api-key";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);
    const keys = await db.agentApiKey.findMany({
      where: { agentId: agent.id },
      select: { id:true,name:true,keyPrefix:true,active:true,lastUsedAt:true,createdAt:true },
      orderBy: { createdAt:"desc" },
    });
    return applyCors(jsonOk({
      keys: keys.map(k => ({...k,lastUsedAt:k.lastUsedAt?.toISOString()??null,createdAt:k.createdAt.toISOString()})),
      baseUrl: new URL("/api/v1", req.url).toString().replace(/\/$/,""),
      endpoint: new URL("/api/v1/agents/"+agent.id+"/chat", req.url).toString(),
      openAiEndpoint: new URL("/api/v1/chat/completions", req.url).toString(),
    }), req.headers.get("origin"));
  } catch(e) { return toErrorResponse(e); }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);
    const body = await readJson<Record<string,unknown>>(req);
    const name = typeof body.name === "string" ? body.name.trim().slice(0,80) : "کلید API";
    if(name.length < 2) return applyCors(jsonError("نام کلید API معتبر نیست.",400),req.headers.get("origin"));
    const key = generateAgentApiKey();
    const keyHash = await hashAgentApiKey(key);
    const prefix = key.slice(0,16);
    const record = await db.agentApiKey.create({data:{agentId:agent.id,name,keyHash,keyPrefix:prefix}});
    await db.auditLog.create({data:{workspaceId:agent.workspaceId,userId:session.user.id,action:"agent.api_key.created",entityType:"AgentApiKey",entityId:record.id,metadata:JSON.stringify({name,keyPrefix:prefix})}});
    return applyCors(jsonOk({
      key,
      keyMeta:{id:record.id,name:record.name,keyPrefix:record.keyPrefix,active:record.active,createdAt:record.createdAt.toISOString()},
      warning:"این کلید فقط یک‌بار نمایش داده می‌شود.",
    },201),req.headers.get("origin"));
  } catch(e) { return toErrorResponse(e); }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session,id);
    const keyId = new URL(req.url).searchParams.get("keyId") ?? "";
    if(!keyId) return applyCors(jsonError("شناسه کلید لازم است.",400),req.headers.get("origin"));
    const key = await db.agentApiKey.findFirst({where:{id:keyId,agentId:agent.id}});
    if(!key) return applyCors(jsonError("کلید API یافت نشد.",404),req.headers.get("origin"));
    await db.agentApiKey.update({where:{id:key.id},data:{active:false}});
    await db.auditLog.create({data:{workspaceId:agent.workspaceId,userId:session.user.id,action:"agent.api_key.revoked",entityType:"AgentApiKey",entityId:key.id}});
    return applyCors(jsonOk({ok:true}),req.headers.get("origin"));
  } catch(e) { return toErrorResponse(e); }
}
