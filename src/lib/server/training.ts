import crypto from "node:crypto";
import { db } from "@/lib/db";

const MIN_EXAMPLES = Number(process.env.CORTEX_TRAINING_MIN_EXAMPLES ?? 8);
const MAX_EXAMPLES = Number(process.env.CORTEX_TRAINING_MAX_EXAMPLES ?? 2000);
const DEFAULT_BASE_MODEL = process.env.CORTEX_TRAINING_BASE_MODEL?.trim() || "Qwen/Qwen3-0.6B";
const AUTO_PROMOTE_MAX_EVAL_LOSS = Number(process.env.CORTEX_TRAINING_MAX_EVAL_LOSS ?? 2.8);
const WORKER_URL = process.env.CORTEX_TRAINING_WORKER_URL?.replace(/\/$/, "") || "";
const WORKER_SECRET = process.env.CORTEX_TRAINING_WORKER_SECRET || "";
const CALLBACK_URL = process.env.CORTEX_TRAINING_CALLBACK_URL || "";
const CALLBACK_SECRET = process.env.CORTEX_TRAINING_CALLBACK_SECRET || "";

function safeInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
}

function extractContext(metadata: string | null) {
  if (!metadata) return "";
  try {
    const parsed = JSON.parse(metadata) as any;
    const retrieval = Array.isArray(parsed.retrieval) ? parsed.retrieval : [];
    return retrieval.slice(0, 4).map((r: any) => {
      const title = String(r.documentName || "منبع");
      const page = r.page ? " · صفحه " + r.page : "";
      return title + page + "\n" + String(r.snippet || "").slice(0, 1800);
    }).join("\n\n");
  } catch {
    return "";
  }
}

export async function captureFeedbackExample(params: {
  workspaceId: string;
  agentId: string;
  userId: string;
  messageId: string;
  score: number;
}) {
  const message = await db.message.findUnique({
    where: { id: params.messageId },
    include: { conversation: { include: { agent: true } } },
  });
  if (!message || message.role !== "assistant" || message.conversation.agentId !== params.agentId || message.conversation.agent.workspaceId !== params.workspaceId) {
    throw Object.assign(new Error("پیام برای آموزش این ایجنت معتبر نیست."), { status: 404 });
  }

  const previous = await db.message.findFirst({
    where: { conversationId: message.conversationId, role: "user", createdAt: { lt: message.createdAt } },
    orderBy: { createdAt: "desc" },
  });
  if (!previous) throw Object.assign(new Error("سؤال اصلی پیام پیدا نشد."), { status: 400 });

  const score = safeInt(params.score, 0, 1, 5);
  const approved = score >= 4;
  const context = extractContext(message.metadata);
  const existing = await db.trainingExample.findFirst({
    where: { messageId: message.id },
    orderBy: { updatedAt: "desc" },
  });

  const data = {
    workspaceId: params.workspaceId,
    agentId: params.agentId,
    userId: params.userId,
    messageId: params.messageId,
    sourceType: "feedback",
    prompt: previous.content.slice(0, 12000),
    response: message.content.slice(0, 12000),
    context: context || null,
    qualityScore: score,
    approved,
    rejectionReason: approved ? null : "feedback_below_training_threshold",
  };

  return existing
    ? db.trainingExample.update({ where: { id: existing.id }, data })
    : db.trainingExample.create({ data });
}

export async function listTrainingExamples(agentId: string, workspaceId: string) {
  return db.trainingExample.findMany({
    where: { agentId, workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true, sourceType: true, qualityScore: true, approved: true,
      prompt: true, response: true, context: true, messageId: true,
      createdAt: true, updatedAt: true,
    },
  });
}

async function buildSamples(agentId: string, workspaceId: string, limit: number) {
  const rows = await db.trainingExample.findMany({
    where: { agentId, workspaceId, approved: true, qualityScore: { gte: 4 } },
    orderBy: [{ qualityScore: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });

  return rows.map((row) => {
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
    if (row.context) {
      messages.push({
        role: "system",
        content: "دانش تأییدشده مرتبط با پاسخ:\n" + row.context.slice(0, 6000),
      });
    }
    messages.push({ role: "user", content: row.prompt }, { role: "assistant", content: row.response });
    return { messages };
  });
}

function datasetHash(samples: unknown[]) {
  return crypto.createHash("sha256").update(JSON.stringify(samples)).digest("hex");
}

export async function startTraining(params: {
  workspaceId: string;
  agentId: string;
  method?: "qlora" | "lora" | "full";
  baseModel?: string;
  config?: Record<string, unknown>;
}) {
  if (!WORKER_URL || !WORKER_SECRET) {
    throw Object.assign(new Error("Training Worker هنوز در تنظیمات زیرساخت فعال نشده است."), {
      status: 503,
      code: "training_worker_unconfigured",
    });
  }

  const samples = await buildSamples(params.agentId, params.workspaceId, MAX_EXAMPLES);
  if (samples.length < MIN_EXAMPLES) {
    throw Object.assign(
      new Error("برای آموزش واقعی حداقل " + MIN_EXAMPLES + " نمونهٔ تأییدشده لازم است؛ اکنون " + samples.length + " نمونه آماده است."),
      { status: 400, code: "training_dataset_too_small" },
    );
  }

  const method = params.method === "full" || params.method === "lora" ? params.method : "qlora";
  const baseModel = (params.baseModel || DEFAULT_BASE_MODEL).trim().slice(0, 240);
  const hash = datasetHash(samples);

  const running = await db.trainingJob.findFirst({
    where: { agentId: params.agentId, workspaceId: params.workspaceId, status: { in: ["queued", "running"] } },
  });
  if (running) return running;

  const job = await db.trainingJob.create({
    data: {
      workspaceId: params.workspaceId,
      agentId: params.agentId,
      status: "queued",
      method,
      baseModel,
      datasetHash: hash,
      sampleCount: samples.length,
      trainConfig: JSON.stringify(params.config ?? {}),
    },
  });

  try {
    const response = await fetch(WORKER_URL + "/v1/train", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + WORKER_SECRET,
      },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        job_id: job.id,
        base_model: baseModel,
        method,
        samples,
        config: params.config ?? {},
        callback_url: CALLBACK_URL,
      }),
    });
    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok) {
      throw new Error(body?.detail || body?.error || ("Training Worker HTTP " + response.status));
    }

    return await db.trainingJob.update({
      where: { id: job.id },
      data: {
        status: "queued",
        workerJobId: body.job_id || job.id,
      },
    });
  } catch (error) {
    await db.trainingJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 1500) : "training worker request failed",
      },
    });
    throw error;
  }
}

export async function handleTrainingCallback(payload: any) {
  const jobId = typeof payload?.jobId === "string" ? payload.jobId : "";
  if (!jobId) throw Object.assign(new Error("شناسه آموزش نامعتبر است."), { status: 400 });

  const job = await db.trainingJob.findUnique({ where: { id: jobId } });
  if (!job) throw Object.assign(new Error("آموزش پیدا نشد."), { status: 404 });

  if (payload.error) {
    return db.trainingJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        error: String(payload.error).slice(0, 1500),
        completedAt: new Date(),
      },
    });
  }

  const evalLoss = Number(payload.eval_loss);
  const sampleCount = Number(payload.samples ?? job.sampleCount);
  const passed =
    Number.isFinite(evalLoss) &&
    evalLoss > 0 &&
    evalLoss <= AUTO_PROMOTE_MAX_EVAL_LOSS &&
    sampleCount >= MIN_EXAMPLES;

  return db.$transaction(async (tx) => {
    const nextJob = await tx.trainingJob.update({
      where: { id: jobId },
      data: {
        status: passed ? "completed" : "rejected",
        evalLoss: Number.isFinite(evalLoss) ? evalLoss : null,
        evalScore: Number.isFinite(evalLoss) ? 1 / (1 + evalLoss) : null,
        artifactPath: typeof payload.artifact_path === "string" ? payload.artifact_path : null,
        workerJobId: typeof payload.job_id === "string" ? payload.job_id : job.workerJobId,
        completedAt: new Date(),
        error: passed
          ? null
          : "ارزیابی خودکار گیت کیفیت رد شد (eval_loss=" + (Number.isFinite(evalLoss) ? evalLoss.toFixed(4) : "نامعتبر") + ").",
      },
    });

    if (!passed) return nextJob;

    const latest = await tx.modelAdapter.findFirst({
      where: { agentId: job.agentId, workspaceId: job.workspaceId },
      orderBy: { version: "desc" },
    });

    const version = (latest?.version ?? 0) + 1;
    const adapter = await tx.modelAdapter.create({
      data: {
        workspaceId: job.workspaceId,
        agentId: job.agentId,
        trainingJobId: job.id,
        baseModel: job.baseModel,
        adapterType: job.method === "full" ? "full" : "lora",
        version,
        artifactUrl: WORKER_URL + "/v1/train/" + job.id,
        inferenceModelId: "cortex-adapter:" + job.id,
        evalLoss: Number.isFinite(evalLoss) ? evalLoss : null,
        evalScore: Number.isFinite(evalLoss) ? 1 / (1 + evalLoss) : null,
        active: true,
      },
    });

    await tx.modelAdapter.updateMany({
      where: { agentId: job.agentId, workspaceId: job.workspaceId, id: { not: adapter.id } },
      data: { active: false },
    });

    await tx.trainingJob.update({
      where: { id: job.id },
      data: { promoted: true },
    });

    await tx.agent.update({
      where: { id: job.agentId },
      data: { modelKey: "trained:" + adapter.id },
    });

    return nextJob;
  });
}

export const trainingConfig = {
  minExamples: MIN_EXAMPLES,
  maxExamples: MAX_EXAMPLES,
  defaultBaseModel: DEFAULT_BASE_MODEL,
  maxEvalLoss: AUTO_PROMOTE_MAX_EVAL_LOSS,
};
