import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, toErrorResponse } from "@/lib/server/http";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
import { decryptSecret, encryptSecret } from "@/lib/server/secrets";
import { getBotInfo, setWebhook, deleteWebhook } from "@/lib/telegram/service";
import { audit } from "@/lib/server/audit";
import { randomBytes } from "@/lib/server/random";

export const dynamic = "force-dynamic";
type Params={params:Promise<{id:string}>};

export async function POST(req:Request,{params}:Params){
  try{
    const session=await requireSession(req);
    const id=(await params).id;
    const bot=await db.telegramBot.findUnique({where:{id},include:{agent:{select:{name:true}},_count:{select:{allowlist:true,users:true}}}});
    if(!bot) return applyCors(jsonError("ربات تلگرام یافت نشد.",404),req.headers.get("origin"));
    const member=assertWorkspaceAccess(session,bot.workspaceId);
    if(!["owner","admin"].includes(member.role)) return applyCors(jsonError("دسترسی مدیریت ربات ندارید.",403),req.headers.get("origin"));

    const token=decryptSecret(bot.tokenEncrypted);
    const info=await getBotInfo(token);
    if(!info) return applyCors(jsonError("توکن ربات معتبر نیست.",502),req.headers.get("origin"));

    if(bot.mode==="webhook"){
      const secret=bot.webhookSecretEncrypted?decryptSecret(bot.webhookSecretEncrypted):Buffer.from(randomBytes(24)).toString("hex");
      if(!bot.webhookSecretEncrypted) await db.telegramBot.update({where:{id:bot.id},data:{webhookSecretEncrypted:encryptSecret(secret)}});
      const publicOrigin=(process.env.APP_PUBLIC_URL||new URL(req.url).origin).replace(/\/$/,"");
      await setWebhook(token,publicOrigin+"/api/telegram/webhook/"+bot.id,secret);
    }else{
      await deleteWebhook(token);
    }

    const updated=await db.telegramBot.update({
      where:{id:bot.id},
      data:{username:info.username??null,status:"connected",lastError:null,lastSeenAt:new Date()},
      include:{agent:{select:{name:true}},_count:{select:{allowlist:true,users:true}}},
    });
    await audit(bot.workspaceId,session.user.id,"telegram-bot.reconnected","telegram_bot",bot.id,{mode:bot.mode});
    return applyCors(jsonOk({bot:{
      id:updated.id,name:updated.name,agentId:updated.agentId,agentName:updated.agent.name,username:updated.username,status:updated.status,mode:updated.mode,
      lastError:updated.lastError,lastSeenAt:updated.lastSeenAt?.toISOString()??null,createdAt:updated.createdAt.toISOString(),updatedAt:updated.updatedAt.toISOString(),
      allowlistCount:updated._count.allowlist,usersCount:updated._count.users
    }}),req.headers.get("origin"));
  }catch(e){return toErrorResponse(e);}
}
