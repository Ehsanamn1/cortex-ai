import { db } from "@/lib/db";
import { after } from "next/server";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin-auth";
import { deleteSourceCompletely, isProcessing, processSource } from "@/lib/knowledge/pipeline";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    const sources = await db.knowledgeSource.findMany({
      where: workspaceId ? { agent: { workspaceId } } : undefined,
      include: {
        agent: { select: { id:true, name:true, workspaceId:true, workspace:{select:{name:true}} } },
        documents: { select: { id:true, name:true, mimeType:true, sizeBytes:true, status:true, error:true, url:true, _count:{select:{chunks:true}} } },
      },
      orderBy: { createdAt:"desc" },
    });
    const totals = await db.knowledgeChunk.groupBy({
      by:["sourceId"],
      where: workspaceId ? { workspaceId } : undefined,
      _count:{_all:true},
    });
    const totalMap=new Map(totals.map(x=>[x.sourceId,x._count?._all ?? 0]));
    return applyCors(jsonOk({
      sources:sources.map(s=>({
        id:s.id,name:s.name,type:s.type,status:s.status,error:s.error,
        createdAt:s.createdAt.toISOString(),updatedAt:s.updatedAt.toISOString(),agent:s.agent,
        chunkCount:totalMap.get(s.id)??0,
        documents:s.documents.map(d=>({id:d.id,name:d.name,mimeType:d.mimeType,sizeBytes:d.sizeBytes,status:d.status,error:d.error,chunkCount:d._count.chunks,hasStoredPayload:Boolean(d.url)})),
      })),
    }),req.headers.get("origin"));
  } catch(e) { return toErrorResponse(e); }
}

export async function POST(req:Request){
  try{
    requireAdmin(req);
    const b=await readJson<Record<string,unknown>>(req);
    const id=typeof b.sourceId==="string"?b.sourceId:"";
    const action=typeof b.action==="string"?b.action:"";
    if(!id)return applyCors(jsonError("شناسه منبع لازم است.",400),req.headers.get("origin"));
    if(action!=="retry")return applyCors(jsonError("عملیات پشتیبانی نمی‌شود.",400),req.headers.get("origin"));
    const source=await db.knowledgeSource.findUnique({where:{id}});
    if(!source)return applyCors(jsonError("منبع دانش یافت نشد.",404),req.headers.get("origin"));
    if(isProcessing(id))return applyCors(jsonError("این منبع در حال پردازش است.",409),req.headers.get("origin"));
    await db.knowledgeSource.update({where:{id},data:{status:"pending",error:null}});
    await db.knowledgeDocument.updateMany({where:{sourceId:id},data:{status:"pending",error:null}});
    after(()=>processSource(id));
    return applyCors(jsonOk({ok:true,status:"pending"},202),req.headers.get("origin"));
  }catch(e){return toErrorResponse(e)}
}

export async function DELETE(req:Request){
  try{
    requireAdmin(req);
    const id=new URL(req.url).searchParams.get("sourceId")??"";
    if(!id)return applyCors(jsonError("sourceId لازم است.",400),req.headers.get("origin"));
    const source=await db.knowledgeSource.findUnique({where:{id}});
    if(!source)return applyCors(jsonError("منبع دانش یافت نشد.",404),req.headers.get("origin"));
    await deleteSourceCompletely(id);
    return applyCors(jsonOk({ok:true}),req.headers.get("origin"));
  }catch(e){return toErrorResponse(e)}
}
