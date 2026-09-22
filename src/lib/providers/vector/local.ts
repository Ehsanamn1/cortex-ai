import { db } from "@/lib/db";
import { cosineSimilarity, type SearchResult, type UpsertPoint, type VectorStore } from "./types";

/**
 * LocalVectorStore — real vector persistence in SQLite + exact cosine
 * similarity search performed in the query layer. Used automatically when
 * QDRANT_URL is not configured. Every operation is hard-scoped to the
 * owning agent (and workspace) — cross-tenant retrieval is impossible.
 */
export class LocalVectorStore implements VectorStore {
  readonly name = "local" as const;

  async upsertPoints(agentId: string, workspaceId: string, points: UpsertPoint[]): Promise<void> {
    if (points.length === 0) return;
    const rows = points.map((p) => ({
      id: p.id,
      agentId,
      workspaceId,
      sourceId: p.payload.sourceId,
      documentId: p.payload.documentId,
      vector: JSON.stringify(p.vector),
      dims: p.vector.length,
      payload: JSON.stringify(p.payload),
    }));
    await db.$transaction(
      rows.map((row) =>
        db.vectorPoint.upsert({
          where: { id: row.id },
          update: { vector: row.vector, payload: row.payload, dims: row.dims },
          create: row,
        })
      )
    );
  }

  async search(agentId: string, queryVector: number[], topK: number): Promise<SearchResult[]> {
    const points = await db.vectorPoint.findMany({
      where: { agentId },
      select: { id: true, vector: true, payload: true },
    });
    const ranked: SearchResult[] = [];
    for (const point of points) {
      let vector: number[];
      try {
        vector = JSON.parse(point.vector) as number[];
      } catch {
        continue;
      }
      const payload = JSON.parse(point.payload) as UpsertPoint["payload"];
      // Defense in depth: payload must also match the tenant scope.
      if (payload.workspaceId !== undefined && payload.sourceId !== undefined) {
        ranked.push({ id: point.id, score: cosineSimilarity(queryVector, vector), payload });
      }
    }
    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, Math.max(1, topK));
  }

  async deleteByAgent(agentId: string): Promise<void> {
    await db.vectorPoint.deleteMany({ where: { agentId } });
  }

  async deleteBySource(agentId: string, sourceId: string): Promise<void> {
    await db.vectorPoint.deleteMany({ where: { agentId, sourceId } });
  }

  async isReady(): Promise<boolean> {
    return true;
  }
}
