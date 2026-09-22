import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { agentFilterForSession, serializeAgent } from "@/lib/server/access";

export const dynamic = "force-dynamic";

const LANGUAGES = new Set(["fa", "en"]);
const TONES = new Set(["professional", "friendly", "concise", "formal", "custom"]);

interface AgentInput {
  name?: unknown;
  orgName?: unknown;
  description?: unknown;
  language?: unknown;
  tone?: unknown;
  customTone?: unknown;
  instructions?: unknown;
  workspaceId?: unknown;
}

function validateAgentInput(body: AgentInput) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    return { error: "نام ایجنت باید بین ۲ تا ۸۰ کاراکتر باشد." as string };
  }
  const language = typeof body.language === "string" ? body.language : "fa";
  if (!LANGUAGES.has(language)) return { error: "زبان انتخابی معتبر نیست." };
  const tone = typeof body.tone === "string" ? body.tone : "professional";
  if (!TONES.has(tone)) return { error: "لحن انتخابی معتبر نیست." };
  const customTone = typeof body.customTone === "string" ? body.customTone.trim().slice(0, 80) : "";
  if (tone === "custom" && customTone.length < 2) {
    return { error: "برای لحن سفارشی، توضیح لحن را وارد کنید." };
  }
  const orgName = typeof body.orgName === "string" ? body.orgName.trim().slice(0, 120) : "";
  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
  const instructions =
    typeof body.instructions === "string" ? body.instructions.trim().slice(0, 4000) : "";
  return {
    data: {
      name,
      orgName: orgName || null,
      description: description || null,
      language,
      tone,
      customTone: tone === "custom" ? customTone : null,
      instructions: instructions || null,
    },
  };
}

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const agents = await db.agent.findMany({
      where: agentFilterForSession(session),
      include: { _count: { select: { knowledgeSources: true, conversations: true } } },
      orderBy: { createdAt: "desc" },
    });
    return applyCors(
      jsonOk({
        agents: agents.map((a) => serializeAgent(a, a._count)),
      }),
      req.headers.get("origin")
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(req);
    const body = await readJson<AgentInput>(req);
    const validated = validateAgentInput(body);
    if ("error" in validated) {
      return applyCors(jsonError(validated.error!, 400), req.headers.get("origin"));
    }

    // Workspace is chosen server-side from the user's own memberships.
    const requestedWorkspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    const membership =
      session.memberships.find((m) => m.workspaceId === requestedWorkspaceId) ??
      session.memberships[0];
    if (!membership) {
      return applyCors(jsonError("فضای کاری معتبری برای ایجاد ایجنت یافت نشد.", 400), req.headers.get("origin"));
    }

    const agent = await db.agent.create({
      data: { ...validated.data!, workspaceId: membership.workspaceId },
      include: { _count: { select: { knowledgeSources: true, conversations: true } } },
    });
    return applyCors(jsonOk({ agent: serializeAgent(agent, agent._count) }, 201), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
