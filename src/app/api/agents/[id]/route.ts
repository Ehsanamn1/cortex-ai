import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { loadAgentForSession, serializeAgent } from "@/lib/server/access";
import { purgeAgentKnowledge } from "@/lib/knowledge/pipeline";

export const dynamic = "force-dynamic";

const LANGUAGES = new Set(["fa", "en"]);
const TONES = new Set(["professional", "friendly", "concise", "formal", "custom"]);

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);
    const [counts, knowledgeReady] = await Promise.all([
      db.agent.findUnique({
        where: { id: agent.id },
        select: {
          _count: {
            select: { knowledgeSources: true, conversations: true },
          },
        },
      }).then(async (c) => ({
        knowledgeSources: c?._count.knowledgeSources ?? 0,
        conversations: c?._count.conversations ?? 0,
        messages: await db.message.count({
          where: { conversation: { agentId: agent.id } },
        }),
      })),
      db.knowledgeSource.count({ where: { agentId: agent.id, status: "ready" } }).then((n) => n > 0),
    ]);
    return applyCors(
      jsonOk({ agent: serializeAgent(agent, counts, knowledgeReady), knowledgeReady }),
      req.headers.get("origin")
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);
    const body = await readJson<Record<string, unknown>>(req);

    const data: Prisma.AgentUpdateInput = {};
    let requestedTone: string | undefined;
    let requestedCustomTone: string | null | undefined;
    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (name.length < 2 || name.length > 80) {
        return applyCors(jsonError("نام ایجنت باید بین ۲ تا ۸۰ کاراکتر باشد.", 400), req.headers.get("origin"));
      }
      data.name = name;
    }
    if (typeof body.orgName === "string") data.orgName = body.orgName.trim().slice(0, 120) || null;
    if (typeof body.description === "string") data.description = body.description.trim().slice(0, 500) || null;
    if (typeof body.instructions === "string") data.instructions = body.instructions.trim().slice(0, 4000) || null;
    if (typeof body.language === "string") {
      if (!LANGUAGES.has(body.language)) {
        return applyCors(jsonError("زبان انتخابی معتبر نیست.", 400), req.headers.get("origin"));
      }
      data.language = body.language;
    }
    if (typeof body.tone === "string") {
      if (!TONES.has(body.tone)) {
        return applyCors(jsonError("لحن انتخابی معتبر نیست.", 400), req.headers.get("origin"));
      }
      requestedTone = body.tone;
      data.tone = body.tone;
    }
    if (typeof body.customTone === "string") {
      requestedCustomTone = body.customTone.trim().slice(0, 80) || null;
      data.customTone = requestedCustomTone;
    }
    const persona = typeof body.persona === "string" ? body.persona : null;
    if (persona !== null) data.persona = persona.trim().slice(0, 2000) || null;
    const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt : null;
    if (systemPrompt !== null) data.systemPrompt = systemPrompt.trim().slice(0, 8000) || null;
    if (typeof body.temperature === "number" && Number.isFinite(body.temperature)) data.temperature = Math.min(2, Math.max(0, body.temperature));
    if (typeof body.topP === "number" && Number.isFinite(body.topP)) data.topP = Math.min(1, Math.max(0, body.topP));
    if (typeof body.maxTokens === "number" && Number.isInteger(body.maxTokens)) data.maxTokens = Math.min(8000, Math.max(128, body.maxTokens));
    if (typeof body.memoryEnabled === "boolean") data.memoryEnabled = body.memoryEnabled;
    if (typeof body.citationsEnabled === "boolean") data.citationsEnabled = body.citationsEnabled;
    if (requestedTone === "custom" && !(requestedCustomTone ?? "").trim() && !agent.customTone) {
      return applyCors(jsonError("برای لحن سفارشی، توضیح لحن را وارد کنید.", 400), req.headers.get("origin"));
    }
    if (Object.keys(data).length === 0) {
      return applyCors(jsonError("فیلدی برای به‌روزرسانی ارسال نشده است.", 400), req.headers.get("origin"));
    }

    const updated = await db.agent.update({
      where: { id: agent.id },
      data,
      include: { _count: { select: { knowledgeSources: true, conversations: true } } },
    });
    return applyCors(jsonOk({ agent: serializeAgent(updated, updated._count) }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);

    // Remove vectors first (they are not FK-cascaded), then rows cascade.
    await purgeAgentKnowledge(agent.id);
    await db.agent.delete({ where: { id: agent.id } });
    return applyCors(jsonOk({ ok: true }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
