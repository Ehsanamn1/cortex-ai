import { db } from "@/lib/db";
import { after } from "next/server";
import { applyCors, jsonError, jsonOk, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { loadAgentForSession } from "@/lib/server/access";
import { rateLimit } from "@/lib/server/rate-limit";
import { processSource } from "@/lib/knowledge/pipeline";
import { isR2Configured } from "@/lib/storage/r2";
import {
  ALLOWED_EXTENSIONS,
  detectExtension,
  sanitizeFilename,
  sniffKind,
  validateUrl,
} from "@/lib/knowledge/extract";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_MAX_UPLOAD_MB = 5;
const MAX_DB_UPLOAD_MB = 10;
const ENV_MAX_UPLOAD_MB = (() => {
  const value = Number(process.env.MAX_UPLOAD_MB);
  return Number.isFinite(value) && value >= 1 ? Math.min(MAX_DB_UPLOAD_MB, Math.floor(value)) : DEFAULT_MAX_UPLOAD_MB;
})();

async function serializeSources(agentId: string) {
  const sources = await db.knowledgeSource.findMany({
    where: { agentId },
    include: { documents: { select: { id: true, name: true, status: true, url: true, _count: { select: { chunks: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const chunkTotals = await db.knowledgeChunk.groupBy({
    by: ["sourceId"],
    where: { agentId },
    _count: { _all: true },
  });
  const totalBySource = new Map(chunkTotals.map((c) => [c.sourceId, c._count._all]));
  return {
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type as "file" | "url",
      status: s.status as "pending" | "processing" | "ready" | "failed",
      error: s.error,
      chunkCount: totalBySource.get(s.id) ?? 0,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      documents: s.documents.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        chunkCount: d._count.chunks,
        // Never expose internal storage payloads to the client.
        url: s.type === "url" ? d.url : null,
      })),
    })),
  };
}

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);
    return applyCors(jsonOk(await serializeSources(agent.id)), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);
    rateLimit(req, "knowledge-upload", 20, 60_000);
    let maxUploadMb = ENV_MAX_UPLOAD_MB;
    try {
      const rows = await db.siteSetting.findMany({ where: { key: "site.maxUploadMb" }, take: 1 });
      const settingLimit = Number(rows[0]?.value ?? 0);
      if (Number.isFinite(settingLimit) && settingLimit >= 1) maxUploadMb = Math.min(MAX_DB_UPLOAD_MB, Math.floor(settingLimit));
    } catch {
      // Fall back to the environment/default limit when optional settings are unavailable.
    }
    const maxUploadBytes = maxUploadMb * 1024 * 1024;

    const contentType = req.headers.get("content-type") ?? "";

    /* ---------- Mode A: multipart file upload (PDF / TXT / DOCX) ---------- */
    if (contentType.includes("multipart/form-data")) {
      if (process.env.NODE_ENV === "production" && !isR2Configured()) {
        return applyCors(
          jsonError("فضای ذخیره‌سازی پایدار R2 برای بارگذاری فایل در محیط تولید فعال نیست.", 503),
          req.headers.get("origin")
        );
      }
      let form: FormData;
      try {
        form = await req.formData();
      } catch {
        return applyCors(jsonError("بدنه بارگذاری فایل معتبر نیست.", 400), req.headers.get("origin"));
      }
      const file = form.get("file");
      if (!(file instanceof File)) {
        return applyCors(jsonError("فایلی برای بارگذاری ارسال نشده است.", 400), req.headers.get("origin"));
      }
      if (file.size === 0) {
        return applyCors(jsonError("فایل ارسالی خالی است.", 400), req.headers.get("origin"));
      }
      if (file.size > maxUploadBytes) {
        return applyCors(
          jsonError(`حجم فایل بیش از حد مجاز است (حداکثر ${maxUploadMb} مگابایت).`, 413),
          req.headers.get("origin")
        );
      }
      const originalName = sanitizeFilename(file.name || "file");
      const ext = detectExtension(originalName);
      if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
        return applyCors(
          jsonError("فقط فایل‌های دارای فرمت پشتیبانی‌شده پذیرفته می‌شوند.", 400),
          req.headers.get("origin")
        );
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const kind = sniffKind(bytes);
      if (
        (ext === ".pdf" && kind !== "pdf") ||
        (ext === ".docx" && kind !== "docx-zip") ||
        (ext === ".txt" && kind === "unknown")
      ) {
        return applyCors(
          jsonError("محتوای فایل با پسوند اعلام‌شده هم‌خوانی ندارد.", 400),
          req.headers.get("origin")
        );
      }

      // Persist metadata first; processing runs async and updates statuses.
      const source = await db.knowledgeSource.create({
        data: {
          agentId: agent.id,
          name: originalName,
          type: "file",
          status: "pending",
        },
      });

      try {
        // R2-free production storage: keep the validated upload in Postgres as an
        // internal db64:// payload until the background ingestion worker processes it.
        const storageUrl = "db64://" + Buffer.from(bytes).toString("base64");
        await db.knowledgeDocument.create({
          data: {
            sourceId: source.id,
            name: originalName,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            url: storageUrl,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 1000) : "ذخیره فایل ناموفق بود.";
        await db.knowledgeSource.update({
          where: { id: source.id },
          data: { status: "failed", error: message },
        }).catch(() => undefined);
        return applyCors(jsonError("ذخیره فایل ناموفق بود؛ وضعیت منبع به failed تغییر کرد.", 502), req.headers.get("origin"));
      }

      after(() => processSource(source.id)); // let the route finish while Workers keeps background work alive
      const serialized = (await serializeSources(agent.id)).sources.find((s) => s.id === source.id);
      return applyCors(jsonOk({ source: serialized }, 202), req.headers.get("origin"));
    }

    /* ---------- Mode B: website URL ingestion ---------- */
    let body: { url?: unknown };
    try {
      body = (await req.json()) as { url?: unknown };
    } catch {
      return applyCors(jsonError("بدنه درخواست معتبر نیست.", 400), req.headers.get("origin"));
    }
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
    if (!rawUrl) {
      return applyCors(jsonError("نشانی وب‌سایت را وارد کنید.", 400), req.headers.get("origin"));
    }
    let parsed: URL;
    try {
      parsed = validateUrl(rawUrl);
    } catch {
      return applyCors(
        jsonError("این آدرس مجاز نیست. تنها آدرس‌های عمومی http/https قابل افزودن هستند.", 400),
        req.headers.get("origin")
      );
    }

    const source = await db.knowledgeSource.create({
      data: { agentId: agent.id, name: parsed.hostname, type: "url", status: "pending" },
    });
    await db.knowledgeDocument.create({
      data: { sourceId: source.id, name: parsed.hostname, url: parsed.toString() },
    });

    after(() => processSource(source.id)); // fetch → extract → chunk → embed → store (async)
    const serialized = (await serializeSources(agent.id)).sources.find((s) => s.id === source.id);
    return applyCors(jsonOk({ source: serialized }, 202), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
