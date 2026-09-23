import { db } from "@/lib/db";
import { getVectorStore } from "@/lib/providers/vector";
import type { UpsertPoint } from "@/lib/providers/vector/types";
import { embeddingManager } from "@/lib/providers/embeddings/manager";
import { chunkInputs, type ChunkInput } from "./chunk";
import { extractFromUrl, extractStoredBytes } from "./extract";
import { deleteR2Object, getR2ObjectBytes } from "@/lib/storage/r2";

/**
 * Knowledge processing pipeline (real, no simulation):
 *   upload/url → validate → extract text → normalize → chunk → embed →
 *   store vectors → persist metadata → mark ready
 *
 * Status transitions: pending → processing → ready | failed.
 * A source is marked READY only after its vectors are actually stored.
 * The route handler triggers this async worker and the UI polls the status.
 */

const processing = new Set<string>();

export function isProcessing(sourceId: string): boolean {
  return processing.has(sourceId);
}

export async function processSource(sourceId: string): Promise<void> {
  if (processing.has(sourceId)) return;

  // Claim the source atomically in PostgreSQL. The in-memory set only avoids
  // duplicate work inside one Worker isolate; the DB claim prevents two
  // isolates from processing the same source concurrently.
  const claimed = await db.knowledgeSource.updateMany({
    where: { id: sourceId, status: { in: ["pending", "failed"] } },
    data: { status: "processing", error: null },
  });
  if (claimed.count === 0) return;

  processing.add(sourceId);
  try {
    const source = await db.knowledgeSource.findUnique({
      where: { id: sourceId },
      include: { agent: true, documents: true },
    });
    if (!source) return;

    await db.knowledgeDocument.updateMany({
      where: { sourceId },
      data: { status: "processing", error: null },
    });

    try {
      // 1) EXTRACT / RESTORE
      // New file uploads carry an internal db64:// payload. Once processing
      // succeeds the raw payload is cleared; retries then rebuild vectors from
      // the durable KnowledgeChunk rows instead of needing file storage.
      let mimeType: string | undefined;
      let sizeBytes: number | undefined;
      let documentUrl: string | undefined;
      let chunks: ChunkInput[];

      if (source.type === "url") {
        const document = source.documents[0];
        documentUrl = document?.url ?? undefined;
        if (!documentUrl) throw new Error("آدرس وب‌سایت برای این منبع ثبت نشده است.");
        const result = await extractFromUrl(documentUrl);
        if (!result.pages || result.pages.length === 0 || result.pages.every((p) => p.text.trim().length === 0)) {
          throw new Error("محتوای متنی قابل استخراجی در این منبع یافت نشد.");
        }
        mimeType = result.mimeType;
        documentUrl = result.finalUrl;
        chunks = chunkInputs(result.pages as ChunkInput[]);
      } else {
        const document = source.documents[0];
        if (!document) throw new Error("فایل این منبع یافت نشد.");

        const storagePath = document.url ?? "";
        if (storagePath.startsWith("r2://")) {
          const key = storagePath.slice("r2://".length);
          if (!key) throw new Error("مسیر فایل R2 معتبر نیست.");
          const bytes = await getR2ObjectBytes(key);
          const result = await extractStoredBytes(bytes, document.name);
          if (!result.pages || result.pages.length === 0 || result.pages.every((p) => p.text.trim().length === 0)) {
            throw new Error("محتوای متنی قابل استخراجی در این فایل یافت نشد.");
          }
          mimeType = result.mimeType;
          sizeBytes = result.sizeBytes;
          chunks = chunkInputs(result.pages as ChunkInput[]);
        } else if (storagePath.startsWith("db64://")) {
          const raw = storagePath.slice("db64://".length);
          if (!raw) throw new Error("داده فایل ذخیره‌شده معتبر نیست.");
          const bytes = new Uint8Array(Buffer.from(raw, "base64"));
          const result = await extractStoredBytes(bytes, document.name);
          if (!result.pages || result.pages.length === 0 || result.pages.every((p) => p.text.trim().length === 0)) {
            throw new Error("محتوای متنی قابل استخراجی در این فایل یافت نشد.");
          }
          mimeType = result.mimeType;
          sizeBytes = result.sizeBytes;
          chunks = chunkInputs(result.pages as ChunkInput[]);
        } else {
          const existing = await db.knowledgeChunk.findMany({
            where: { sourceId: source.id, documentId: document.id },
            orderBy: { seq: "asc" },
            select: { text: true, page: true, section: true, seq: true },
          });
          if (existing.length === 0) {
            throw new Error("فایل اصلی این منبع دیگر در Storage داخلی موجود نیست؛ لطفاً فایل را دوباره اضافه کنید.");
          }
          mimeType = document.mimeType ?? undefined;
          sizeBytes = document.sizeBytes ?? undefined;
          chunks = existing.map((item) => ({
            text: item.text,
            page: item.page ?? undefined,
            section: item.section,
            seq: item.seq,
          }));
        }
      }

      // 3) EMBED — real vectors via the configured provider
      const embedder = embeddingManager.resolve();
      if (!embedder) {
        throw new Error(
          "سرویس جاسازی متن (Embedding) پیکربندی نشده است؛ پردازش دانش ممکن نیست. تنظیمات سرویس‌دهنده را بررسی کنید."
        );
      }
      // 3) EMBED + 4) STORE — process in bounded batches so very large
      // documents do not require all vectors to sit in memory at once.
      await purgeSourceVectors(source.agentId, sourceId);

      const document = source.documents[0]!;
      const vectorStore = getVectorStore();
      const EMBED_BATCH = 32;
      const persistedUrl = source.type === "url" ? documentUrl ?? document.url : null;

      await db.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          status: "processing",
          mimeType: mimeType ?? document.mimeType,
          sizeBytes: sizeBytes ?? document.sizeBytes,
          url: persistedUrl,
          error: null,
        },
      });

      for (let start = 0; start < chunks.length; start += EMBED_BATCH) {
        const batch = chunks.slice(start, start + EMBED_BATCH);
        const vectors = await embedder.embedDocuments(batch.map((item) => item.text));
        const points: UpsertPoint[] = [];

        for (let offset = 0; offset < batch.length; offset++) {
          const index = start + offset;
          const chunk = batch[offset]!;
          const vector = vectors[offset]!;
          const created = await db.knowledgeChunk.create({
            data: {
              id: crypto.randomUUID(),
              documentId: document.id,
              sourceId: source.id,
              agentId: source.agentId,
              workspaceId: source.agent.workspaceId,
              seq: index,
              text: chunk.text,
              page: chunk.page,
              section: chunk.section,
              sourceUrl: documentUrl ?? null,
              metadata: JSON.stringify({
                documentName: document.name,
                sourceType: source.type,
                sourceName: source.name,
              }),
            },
          });
          points.push({
            id: created.id,
            vector,
            payload: {
              chunkId: created.id,
              text: chunk.text,
              documentName: document.name,
              page: chunk.page,
              section: chunk.section,
              sourceUrl: documentUrl ?? null,
              seq: index,
              sourceId: source.id,
              documentId: document.id,
              workspaceId: source.agent.workspaceId,
            },
          });
        }

        await vectorStore.upsertPoints(source.agentId, source.agent.workspaceId, points);
      }

      // 5) READY — only now, after vectors are truly stored
      await db.knowledgeDocument.update({
        where: { id: document.id },
        data: { status: "ready", error: null },
      });
      await db.knowledgeSource.update({
        where: { id: source.id },
        data: { status: "ready", error: null },
      });
    } catch (e) {
      const safeMessage =
        e instanceof Error && isUserSafeMessage(e.message)
          ? e.message
          : "پردازش این منبع دانش با خطا مواجه شد.";
      console.error(`[cortex][knowledge] source ${sourceId} failed:`, e instanceof Error ? e.stack ?? e.message : e);
      await db.knowledgeSource.update({
        where: { id: sourceId },
        data: { status: "failed", error: safeMessage },
      }).catch(() => undefined);
      await db.knowledgeDocument.updateMany({
        where: { sourceId },
        data: { status: "failed", error: safeMessage },
      }).catch(() => undefined);
    }
  } finally {
    processing.delete(sourceId);
  }
}

/** Errors we deliberately surface to users (Persian, no internals). */
function isUserSafeMessage(message: string): boolean {
  return /[\u0600-\u06FF]/.test(message);
}

async function purgeSourceVectors(agentId: string, sourceId: string): Promise<void> {
  const vectorStore = getVectorStore();
  await vectorStore.deleteBySource(agentId, sourceId);
  await db.knowledgeChunk.deleteMany({ where: { sourceId } });
}

/** Full removal of a source: DB rows/chunks and the inline upload payload are cleared by cascade. */
export async function deleteSourceCompletely(sourceId: string): Promise<void> {
  const source = await db.knowledgeSource.findUnique({
    where: { id: sourceId },
    include: { documents: true },
  });
  if (!source) return;

  await purgeSourceVectors(source.agentId, sourceId);
  for (const document of source.documents) {
    if (document.url?.startsWith("r2://")) await deleteR2Object(document.url.slice("r2://".length)).catch(() => undefined);
  }
  await db.knowledgeSource.delete({ where: { id: sourceId } }); // cascades documents
}

/** Full removal of an agent's knowledge (used on agent deletion). */
export async function purgeAgentKnowledge(agentId: string): Promise<void> {
  const r2Docs = await db.knowledgeDocument.findMany({ where: { source: { agentId }, url: { startsWith: "r2://" } }, select: { url: true } });
  await Promise.all(r2Docs.map((d) => d.url ? deleteR2Object(d.url.slice("r2://".length)).catch(() => undefined) : Promise.resolve()));
  const vectorStore = getVectorStore();
  await vectorStore.deleteByAgent(agentId);
  await db.knowledgeChunk.deleteMany({ where: { agentId } });
}
