import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, toErrorResponse } from "@/lib/server/http";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){try{const session=await requireSession(req);const {id}=await params;const row=await db.execution.findUnique({where:{id},include:{agent:{select:{id:true,name:true}},workflow:{select:{id:true,name:true}},steps:{orderBy:{seq:"asc"}}}});if(!row)return applyCors(jsonError("Execution پیدا نشد.",404),req.headers.get("origin"));assertWorkspaceAccess(session,row.workspaceId);return applyCors(jsonOk({execution:row}),req.headers.get("origin"));}catch(e){return toErrorResponse(e,req.headers.get("origin"));}}
