import { db } from "@/lib/db";
import { getVectorStore } from "@/lib/providers/vector";
import { embeddingManager } from "@/lib/providers/embeddings/manager";
import { chunkInputs, type ChunkInput } from "./chunk";
import { extractFromUrl, extractStoredFile, removeUploadDir, UPLOAD_ROOT } from "./extract";
import fs from "fs/promises";
import path from "path";
import { createWriteStream } from "fs";
import { randomUUID } from "crypto";

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
  processing.add(sourceId);
  try {
    const source = await db.knowledgeSource.findUnique({
      where: { id: sourceId },
      include: { agent: true, documents: true },
    });
    if (!source) return;

    await db.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: "processing", error: null },
    });
    await db.knowledgeDocument.updateMany({
      where: { sourceId },
      data: { status: "processing", error: null },
    });

    try {
      // 1) EXTRACT — real text extraction
      let pages: Array<{ text: string; page?: number; section?: string | null }>;
      let mimeType: string | undefined;
      let sizeBytes: number | undefined;
      let documentUrl: string | undefined;

      if (source.type === "url") {
        const document = source.documents[0];
        documentUrl = document?.url ?? undefined;
        if (!documentUrl) throw new Error("آدرس وب‌سایت برای این منبع ثبت نشده است.");
        const result = await extractFromUrl(documentUrl);
        pages = result.pages;
        mimeType = result.mimeType;
        documentUrl = result.finalUrl;
      } else {
        const document = source.documents[0];
        if (!document) throw new Error("فایل این منبع یافت نشد.");
        // The upload was persisted server-side at request time under .data/uploads/<sourceId>
        const result = await extractStoredFileForSource(sourceId, document.name);
        pages = result.pages;
        mimeType = result.mimeType;
        sizeBytes = result.sizeBytes;
      }

      if (!pages || pages.length === 0 || pages.every((p) => p.text.trim().length === 0)) {
        throw new Error("محتوای متنی قابل استخراجی در این منبع یافت نشد.");
      }

      // 2) CHUNK — with page/section identity preserved
      const chunks = chunkInputs(pages as ChunkInput[]);
      if (chunks.length === 0) {
        throw new Error("پس از پردازش، هیچ بخش متنی معتبری به دست نیامد.");
      }

      // 3) EMBED — real vectors via the configured provider
      const embedder = embeddingManager.resolve();
      if (!embedder) {
        throw new Error(
          "سرویس جاسازی متن (Embedding) پیکربندی نشده است؛ پردازش دانش ممکن نیست. تنظیمات سرویس‌دهنده را بررسی کنید."
        );
      }
      const vectors = await embedder.embedDocuments(chunks.map((c) => c.text));

      // 4) STORE — chunks in the DB, vectors in the vector store
      await purgeSourceVectors(source.agentId, sourceId);

      const document = source.documents[0]!;
      await db.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          status: "processing",
          mimeType: mimeType ?? document.mimeType,
          sizeBytes: sizeBytes ?? document.sizeBytes,
          url: documentUrl ?? document.url,
          error: null,
        },
      });

      const vectorStore = getVectorStore();
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        const vector = vectors[i]!;
        const created = await db.knowledgeChunk.create({
          data: {
            id: crypto.randomUUID(),
            documentId: document.id,
            sourceId: source.id,
            agentId: source.agentId,
            workspaceId: source.agent.workspaceId,
            seq: chunk.seq,
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
        await vectorStore.upsertPoints(source.agentId, source.agent.workspaceId, [
          {
            id: created.id,
            vector,
            payload: {
              chunkId: created.id,
              text: chunk.text,
              documentName: document.name,
              page: chunk.page,
              section: chunk.section,
              sourceUrl: documentUrl ?? null,
              seq: chunk.seq,
              sourceId: source.id,
              documentId: document.id,
              workspaceId: source.agent.workspaceId,
            },
          },
        ]);
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

/** Full removal of a source: rows cascade in the DB, vectors purged, upload dir cleared. */
export async function deleteSourceCompletely(sourceId: string): Promise<void> {
  const source = await db.knowledgeSource.findUnique({ where: { id: sourceId } });
  if (!source) return;
  await purgeSourceVectors(source.agentId, sourceId);
  await db.knowledgeSource.delete({ where: { id: sourceId } }); // cascades documents
  if (source.type === "file") await removeUploadDir(sourceId);
}

/** Full removal of an agent's knowledge (used on agent deletion). */
export async function purgeAgentKnowledge(agentId: string): Promise<void> {
  const vectorStore = getVectorStore();
  await vectorStore.deleteByAgent(agentId);
  await db.knowledgeChunk.deleteMany({ where: { agentId } });
}

async function extractStoredFileForSource(
  sourceId: string,
  documentName: string
): Promise<{ pages: Array<{ text: string; page?: number; section?: string | null }>; mimeType?: string; sizeBytes?: number }> {
  const dir = path.join(UPLOAD_ROOT, sourceId);
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  if (entries.length > 0) {
    const filePath = path.join(dir, entries[0]!);
    return extractStoredFile(filePath, documentName);
  }

  const document = await db.knowledgeDocument.findFirst({ where: { sourceId } });
  const storagePath = document?.url;
  if (!storagePath || !storagePath.startsWith("knowledge/")) {
    throw new Error("فایل بارگذاری‌شده برای این منبع در سرور یافت نشد؛ لطفاً منبع را دوباره اضافه کنید.");
  }

  let blobResult: { stream: ReadableStream<Uint8Array> };
  try {
    const { get } = await import("@vercel/blob");
    blobResult = await get(storagePath, { access: "private" });
  } catch {
    throw new Error("فایل ذخیره‌شده در Storage در دسترس نیست؛ اتصال Storage را بررسی کنید.");
  }

  await fs.mkdir(dir, { recursive: true });
  const tempPath = path.join(dir, `${randomUUID()}-${sanitizeFilename(documentName)}`);
  const output = createWriteStream(tempPath);
  const reader = blobResult.stream.getReader();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        if (!output.write(Buffer.from(value))) {
          await new Promise<void>((resolve, reject) => {
            output.once("drain", resolve);
            output.once("error", reject);
          });
        }
      }
    }
    await new Promise<void>((resolve, reject) => {
      output.end(() => resolve());
      output.once("error", reject);
    });
    return await extractStoredFile(tempPath, documentName);
  } finally {
    await reader.cancel().catch(() => undefined);
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
  }
}
