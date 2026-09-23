import { db } from "@/lib/db";
import { after } from "next/server";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { loadAgentForSession } from "@/lib/server/access";
import { rateLimit } from "@/lib/server/rate-limit";
import { createR2PresignedPut, isR2Configured, r2MaxUploadBytes } from "@/lib/storage/r2";
import { ALLOWED_EXTENSIONS, detectExtension, sanitizeFilename } from "@/lib/knowledge/extract";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);
    rateLimit(req, "knowledge-r2-upload", 12, 60_000);

    if (!isR2Configured()) {
      return applyCors(jsonError("فضای ذخیره‌سازی R2 هنوز پیکربندی نشده است؛ برای فایل‌های بزرگ باید R2 را فعال کنید.", 503), req.headers.get("origin"));
    }

    const body = await readJson<{ name?: unknown; size?: unknown; mimeType?: unknown }>(req);
    const name = typeof body.name === "string" ? sanitizeFilename(body.name) : "file";
    const size = typeof body.size === "number" && Number.isFinite(body.size) ? Math.floor(body.size) : 0;
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.slice(0, 180) : "application/octet-stream";
    const ext = detectExtension(name);

    if (size < 1) return applyCors(jsonError("حجم فایل معتبر نیست.", 400), req.headers.get("origin"));
    if (size > r2MaxUploadBytes()) return applyCors(jsonError("حجم فایل بیش از حد مجاز است (حداکثر ۲۰۰ مگابایت).", 413), req.headers.get("origin"));
    if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
      return applyCors(jsonError("فرمت این فایل برای دانش Cortex پشتیبانی نمی‌شود.", 400), req.headers.get("origin"));
    }

    const source = await db.knowledgeSource.create({
      data: { agentId: agent.id, name, type: "file", status: "pending" },
    });
    const key = "knowledge/" + agent.workspaceId + "/" + agent.id + "/" + source.id + "/" + crypto.randomUUID() + "-" + name;
    const document = await db.knowledgeDocument.create({
      data: { sourceId: source.id, name, mimeType, sizeBytes: size, url: "r2://" + key },
    });

    const serialized = {
      id: source.id,
      name: source.name,
      type: "file" as const,
      status: "pending" as const,
      error: null,
      chunkCount: 0,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
      documents: [{ id: document.id, name, status: "pending", chunkCount: 0, url: null }],
    };
    return applyCors(
      jsonOk({ source: serialized, upload: { url: createR2PresignedPut(key), key, expiresIn: 900, maxSizeMb: 200 } }, 202),
      req.headers.get("origin")
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
