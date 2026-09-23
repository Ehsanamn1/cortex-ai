import { db } from "@/lib/db";
import { after } from "next/server";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { loadAgentForSession } from "@/lib/server/access";
import { rateLimit } from "@/lib/server/rate-limit";
import { headR2Object, isR2Configured, r2MaxUploadBytes } from "@/lib/storage/r2";
import { processSource } from "@/lib/knowledge/pipeline";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);
    rateLimit(req, "knowledge-r2-complete", 20, 60_000);

    if (!isR2Configured()) return applyCors(jsonError("فضای ذخیره‌سازی R2 پیکربندی نشده است.", 503), req.headers.get("origin"));
    const body = await readJson<{ sourceId?: unknown; key?: unknown; size?: unknown }>(req);
    const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
    const key = typeof body.key === "string" ? body.key : "";
    const source = await db.knowledgeSource.findUnique({ where: { id: sourceId }, include: { documents: true } });

    if (!source || source.agentId !== agent.id) return applyCors(jsonError("منبع دانش معتبر نیست.", 404), req.headers.get("origin"));
    const document = source.documents[0];
    if (!document || document.url !== "r2://" + key) return applyCors(jsonError("فایل با این منبع تطبیق ندارد.", 400), req.headers.get("origin"));

    const head = await headR2Object(key);
    if (head.size < 1 || head.size > r2MaxUploadBytes()) return applyCors(jsonError("حجم فایل خارج از محدوده مجاز است.", 413), req.headers.get("origin"));
    if (typeof body.size === "number" && Number.isFinite(body.size) && Math.floor(body.size) !== head.size) {
      return applyCors(jsonError("حجم فایل بارگذاری‌شده با اندازه ثبت‌شده برابر نیست.", 400), req.headers.get("origin"));
    }

    await db.knowledgeDocument.update({
      where: { id: document.id },
      data: { status: "pending", sizeBytes: head.size, mimeType: head.contentType || document.mimeType, error: null },
    });
    await db.knowledgeSource.update({ where: { id: source.id }, data: { status: "pending", error: null } });
    after(() => processSource(source.id));

    return applyCors(jsonOk({
      source: {
        id: source.id, name: source.name, type: "file", status: "pending", error: null, chunkCount: 0,
        createdAt: source.createdAt.toISOString(), updatedAt: new Date().toISOString(),
        documents: [{ id: document.id, name: document.name, status: "pending", chunkCount: 0, url: null }],
      },
    }, 202), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
