import { db } from "@/lib/db";
import { applyCors, jsonOk, toErrorResponse } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin-auth";

export const dynamic="force-dynamic";

export async function GET(req:Request){
  try{
    requireAdmin(req);
    const workspaceId=new URL(req.url).searchParams.get("workspaceId");
    const bots=await db.telegramBot.findMany({
      where:workspaceId?{workspaceId}:undefined,
      select:{id:true,name:true,username:true,workspaceId:true,agentId:true,status:true,mode:true},
      orderBy:{createdAt:"desc"},
    });
    return applyCors(jsonOk({bots}),req.headers.get("origin"));
  }catch(e){return toErrorResponse(e);}
}
