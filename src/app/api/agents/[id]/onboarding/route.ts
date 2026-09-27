import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
import { loadAgentForSession } from "@/lib/server/access";
import { BUSINESS_ONBOARDING_QUESTIONS, synthesizeOnboarding, type OnboardingQuestion } from "@/lib/agents/onboarding";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

function assertAdminRole(role: string) {
  if (!["owner", "admin"].includes(role)) throw Object.assign(new Error("فقط مالک یا مدیر می‌تواند راه‌اندازی هوشمند کسب‌وکار را اجرا کند."), { status: 403 });
}

function publicSession(session: any) {
  const answers = JSON.parse(session.answersJson) as Array<{ questionId: string; answer: string }>;
  const question: OnboardingQuestion | null = session.status === "active" && session.currentIndex < BUSINESS_ONBOARDING_QUESTIONS.length
    ? BUSINESS_ONBOARDING_QUESTIONS[session.currentIndex] ?? null : null;
  return {
    id: session.id, status: session.status, currentIndex: session.currentIndex, totalQuestions: BUSINESS_ONBOARDING_QUESTIONS.length,
    question, answersCount: answers.length, result: session.resultJson ? JSON.parse(session.resultJson) : null, error: session.error ?? null,
    completedAt: session.completedAt?.toISOString() ?? null, createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString(),
  };
}

async function getAgentAndMembership(req: Request, id: string) {
  const session = await requireSession(req);
  const agent = await loadAgentForSession(session, id);
  const membership = assertWorkspaceAccess(session, agent.workspaceId);
  assertAdminRole(membership.role);
  return { session, agent };
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { agent } = await getAgentAndMembership(req, (await params).id);
    const active = await db.agentOnboardingSession.findFirst({ where: { agentId: agent.id, status: "active" }, orderBy: { createdAt: "desc" } });
    const latest = active ?? await db.agentOnboardingSession.findFirst({ where: { agentId: agent.id }, orderBy: { createdAt: "desc" } });
    return applyCors(jsonOk({ session: latest ? publicSession(latest) : null, questions: BUSINESS_ONBOARDING_QUESTIONS }), req.headers.get("origin"));
  } catch (e) { return toErrorResponse(e); }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { agent } = await getAgentAndMembership(req, (await params).id);
    const body = await readJson<Record<string, unknown>>(req);
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "start") {
      await db.agentOnboardingSession.updateMany({ where: { agentId: agent.id, status: "active" }, data: { status: "cancelled" } });
      const session = await db.agentOnboardingSession.create({ data: { workspaceId: agent.workspaceId, agentId: agent.id, status: "active", currentIndex: 0, answersJson: "[]" } });
      return applyCors(jsonOk({ session: publicSession(session) }, 201), req.headers.get("origin"));
    }

    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    if (!sessionId) return applyCors(jsonError("شناسه جلسه راه‌اندازی لازم است.", 400), req.headers.get("origin"));
    const current = await db.agentOnboardingSession.findFirst({ where: { id: sessionId, agentId: agent.id } });
    if (!current) return applyCors(jsonError("جلسه راه‌اندازی پیدا نشد.", 404), req.headers.get("origin"));

    if (action === "cancel") {
      if (current.status === "active") await db.agentOnboardingSession.update({ where: { id: current.id }, data: { status: "cancelled" } });
      const cancelled = await db.agentOnboardingSession.findUniqueOrThrow({ where: { id: current.id } });
      return applyCors(jsonOk({ session: publicSession(cancelled) }), req.headers.get("origin"));
    }

    if (action !== "answer") return applyCors(jsonError("عملیات راه‌اندازی معتبر نیست.", 400), req.headers.get("origin"));
    if (current.status !== "active") return applyCors(jsonError("این جلسه دیگر فعال نیست.", 409), req.headers.get("origin"));
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";
    if (!answer) return applyCors(jsonError("پاسخ نمی‌تواند خالی باشد.", 400), req.headers.get("origin"));
    if (answer.length > 6000) return applyCors(jsonError("پاسخ بیش از حد طولانی است. لطفاً خلاصه‌تر پاسخ دهید.", 400), req.headers.get("origin"));
    const question = BUSINESS_ONBOARDING_QUESTIONS[current.currentIndex];
    if (!question) return applyCors(jsonError("سؤال بعدی پیدا نشد.", 409), req.headers.get("origin"));

    const answers = JSON.parse(current.answersJson) as Array<{ questionId: string; answer: string }>;
    answers.push({ questionId: question.id, answer });
    const nextIndex = current.currentIndex + 1;

    if (nextIndex < BUSINESS_ONBOARDING_QUESTIONS.length) {
      const updated = await db.agentOnboardingSession.update({ where: { id: current.id }, data: { currentIndex: nextIndex, answersJson: JSON.stringify(answers), error: null } });
      return applyCors(jsonOk({ session: publicSession(updated) }), req.headers.get("origin"));
    }

    const answerPairs = answers.map(item => ({
      question: BUSINESS_ONBOARDING_QUESTIONS.find(q => q.id === item.questionId)!,
      answer: item.answer,
    }));
    try {
      const synthesized = await synthesizeOnboarding(answerPairs, agent.id, agent.workspaceId);
      const completed = await db.agentOnboardingSession.update({
        where: { id: current.id },
        data: { status: "completed", currentIndex: BUSINESS_ONBOARDING_QUESTIONS.length, answersJson: JSON.stringify(answers), resultJson: JSON.stringify(synthesized.result), error: null, completedAt: new Date() },
      });
      return applyCors(jsonOk({ session: publicSession(completed), knowledgeSourceId: synthesized.knowledgeSourceId }), req.headers.get("origin"));
    } catch (error) {
      await db.agentOnboardingSession.update({ where: { id: current.id }, data: { answersJson: JSON.stringify(answers), error: error instanceof Error ? error.message.slice(0, 1000) : "خطای ساخت دانش" } }).catch(() => undefined);
      throw error;
    }
  } catch (e) { return toErrorResponse(e); }
}
