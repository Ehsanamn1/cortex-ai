import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
import { captureFeedbackExample, listTrainingExamples, startTraining, trainingConfig } from "@/lib/server/training";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    if (!trainingConfig.enabled) return applyCors(jsonError("آموزش و فاین‌تیون مدل فعلاً غیرفعال است و به‌زودی فعال می‌شود.", 503), req.headers.get("origin"));
    const session = await requireSession(req);
    const agentId = (await params).id;
    const agent = await db.agent.findUnique({ where: { id: agentId }, select: { id: true, workspaceId: true } });
    if (!agent) return applyCors(jsonError("ایجنت پیدا نشد.", 404), req.headers.get("origin"));
    assertWorkspaceAccess(session, agent.workspaceId);

    const [examples, jobs, adapters] = await Promise.all([
      listTrainingExamples(agent.id, agent.workspaceId),
      db.trainingJob.findMany({
        where: { agentId: agent.id, workspaceId: agent.workspaceId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.modelAdapter.findMany({
        where: { agentId: agent.id, workspaceId: agent.workspaceId },
        orderBy: { version: "desc" },
        take: 20,
      }),
    ]);

    return applyCors(jsonOk({ examples, jobs, adapters }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const agentId = (await params).id;
    const agent = await db.agent.findUnique({ where: { id: agentId }, select: { id: true, workspaceId: true } });
    if (!agent) return applyCors(jsonError("ایجنت پیدا نشد.", 404), req.headers.get("origin"));
    const membership = assertWorkspaceAccess(session, agent.workspaceId);
    const body = await readJson<Record<string, unknown>>(req);
    const action = typeof body.action === "string" ? body.action : "feedback";

    if (action === "feedback") {
      const messageId = typeof body.messageId === "string" ? body.messageId : "";
      const score = Number(body.score ?? 0);
      if (!messageId || !Number.isFinite(score)) {
        return applyCors(jsonError("بازخورد آموزش معتبر نیست.", 400), req.headers.get("origin"));
      }
      const example = await captureFeedbackExample({
        workspaceId: agent.workspaceId,
        agentId,
        userId: session.user.id,
        messageId,
        score,
      });
      return applyCors(jsonOk({ example }), req.headers.get("origin"));
    }

    if (action === "start") {
      if (!["owner", "admin"].includes(membership.role)) {
        return applyCors(jsonError("فقط مالک یا مدیر فضای کاری می‌تواند آموزش را اجرا کند.", 403), req.headers.get("origin"));
      }
      const method = body.method === "full" || body.method === "lora" ? body.method : "qlora";
      const config = body.config && typeof body.config === "object" ? body.config as Record<string, unknown> : {};
      const job = await startTraining({
        workspaceId: agent.workspaceId,
        agentId,
        method,
        baseModel: typeof body.baseModel === "string" ? body.baseModel : undefined,
        config,
      });
      return applyCors(jsonOk({ job }), req.headers.get("origin"));
    }

    return applyCors(jsonError("عملیات آموزش پشتیبانی نمی‌شود.", 400), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
