import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { serializeAgent } from "@/lib/server/access";
import { getManagedModelCatalog } from "@/lib/server/model-router";
import { getPlanFeatureLimits, planFeatureError } from "@/lib/server/plan-policy";

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
  persona?: unknown;
  systemPrompt?: unknown;
  temperature?: unknown;
  topP?: unknown;
  maxTokens?: unknown;
  memoryEnabled?: unknown;
  citationsEnabled?: unknown;
  modelKey?: unknown;
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
  const persona = typeof body.persona === "string" ? body.persona.trim().slice(0, 2000) : "";
  const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt.trim().slice(0, 8000) : "";
  const temperature = typeof body.temperature === "number" && Number.isFinite(body.temperature) ? Math.min(2, Math.max(0, body.temperature)) : 0.7;
  const topP = typeof body.topP === "number" && Number.isFinite(body.topP) ? Math.min(1, Math.max(0, body.topP)) : 1;
  const maxTokens = typeof body.maxTokens === "number" && Number.isInteger(body.maxTokens) ? Math.min(8000, Math.max(128, body.maxTokens)) : 1200;
  const memoryEnabled = body.memoryEnabled !== false;
  const citationsEnabled = body.citationsEnabled !== false;
  const modelKey = typeof body.modelKey === "string" && getManagedModelCatalog().some((model) => model.key === body.modelKey)
    ? body.modelKey
    : "launch-fast";
  return {
    data: {
      name,
      orgName: orgName || null,
      description: description || null,
      language,
      tone,
      customTone: tone === "custom" ? customTone : null,
      instructions: instructions || null,
      persona: persona || null,
      systemPrompt: systemPrompt || null,
      temperature,
      topP,
      maxTokens,
      memoryEnabled,
      citationsEnabled,
      modelKey,
    },
  };
}

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const requestedWorkspaceId = new URL(req.url).searchParams.get("workspaceId");
    const workspaceId = requestedWorkspaceId ?? session.memberships[0]?.workspaceId;
    if (!workspaceId) {
      return applyCors(jsonOk({ agents: [] }), req.headers.get("origin"));
    }
    const membership = session.memberships.find((m) => m.workspaceId === workspaceId);
    if (!membership) {
      return applyCors(jsonError("دسترسی به این فضای کاری ندارید.", 403), req.headers.get("origin"));
    }
    const agents = await db.agent.findMany({
      where: { workspaceId },
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

    const billing = await db.workspaceBillingAccount.findUnique({
      where: { workspaceId: membership.workspaceId },
      include: { plan: true },
    });
    if (!billing) return applyCors(jsonError("حساب اعتبار فضای کاری پیدا نشد.", 404), req.headers.get("origin"));
    const limits = getPlanFeatureLimits(billing.plan.key);
    // Trial is intentionally limited to exactly one Agent. Keep this invariant
    // explicit at the API boundary so legacy/cached plan policy data cannot
    // accidentally turn the Trial workspace into a zero-Agent experience.
    const maxAgents =
      billing.plan.key === "free"
        ? Math.max(1, limits.maxAgents ?? 1)
        : limits.maxAgents;
    if (maxAgents !== null) {
      const agentCount = await db.agent.count({ where: { workspaceId: membership.workspaceId } });
      if (agentCount >= maxAgents) throw planFeatureError("تعداد Agent");
    }

    if (!getManagedModelCatalog().some((model) => model.key === validated.data!.modelKey && model.planKeys.includes(billing.plan.key as any))) {
      return applyCors(jsonError("مدل انتخابی در پلن فعلی در دسترس نیست.", 403), req.headers.get("origin"));
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
