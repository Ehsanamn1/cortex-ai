import { db } from "@/lib/db";
import { assertWorkspaceAccess, requireSession } from "@/lib/server/auth";
import { applyCors, jsonError, jsonOk, toErrorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

function normalizeQuery(q: string) {
  return q
    .replace(/[\u200c\u200f\u200e]/g, " ")
    .replace(/[،؛,;|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const params = new URL(req.url).searchParams;
    const workspaceId = params.get("workspaceId") ?? session.memberships[0]?.workspaceId;
    const q = normalizeQuery(params.get("q") ?? "");

    if (!workspaceId) return jsonError("فضای کاری پیدا نشد.", 404);
    assertWorkspaceAccess(session, workspaceId);
    if (q.length < 2) return applyCors(jsonOk({ results: [] }), req.headers.get("origin"));

    const terms = q.split(" ").filter(Boolean).slice(0, 6);
    const matchFields = ["name","description","orgName","instructions","persona","systemPrompt"] as const;

    const [agents, knowledge, conversations] = await Promise.all([
      db.agent.findMany({
        where: {
          workspaceId,
          OR: matchFields.flatMap((field) => terms.map((term) => ({
            [field]: { contains: term, mode: "insensitive" as const },
          }))),
        },
        select: { id:true,name:true,description:true },
        orderBy: { updatedAt:"desc" },
        take: 8,
      }),
      db.knowledgeSource.findMany({
        where: {
          agent:{workspaceId},
          OR:[
            { name:{contains:q,mode:"insensitive"} },
            { documents:{some:{OR:terms.flatMap((term)=>[
              {name:{contains:term,mode:"insensitive" as const}},
              {url:{contains:term,mode:"insensitive" as const}},
            ])}}},
          ],
        },
        select:{id:true,name:true,type:true,status:true,agentId:true,agent:{select:{name:true}}},
        orderBy:{updatedAt:"desc"},
        take:8,
      }),
      db.conversation.findMany({
        where:{
          agent:{workspaceId},
          OR:[
            {title:{contains:q,mode:"insensitive"}},
            {messages:{some:{OR:terms.map((term)=>({content:{contains:term,mode:"insensitive" as const}}))}}},
          ],
        },
        select:{id:true,title:true,channel:true,agentId:true,agent:{select:{name:true}}},
        orderBy:{updatedAt:"desc"},
        take:8,
      }),
    ]);

    return applyCors(jsonOk({
      results:[
        ...agents.map(x=>({type:"agent" as const,id:x.id,title:x.name,subtitle:x.description??"ایجنت",agentId:x.id})),
        ...knowledge.map(x=>({type:"knowledge" as const,id:x.id,title:x.name,subtitle:x.agent.name+" · "+x.status,agentId:x.agentId})),
        ...conversations.map(x=>({type:"conversation" as const,id:x.id,title:x.title,subtitle:x.agent.name+" · "+x.channel,agentId:x.agentId})),
      ],
    }),req.headers.get("origin"));
  } catch(e) {
    return toErrorResponse(e,req.headers.get("origin"));
  }
}
