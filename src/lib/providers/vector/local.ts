import { db } from "@/lib/db";
import { cosineSimilarity, type SearchResult, type UpsertPoint, type VectorStore } from "./types";

type CachedPoint = { id: string; vector: number[]; payload: UpsertPoint["payload"] };
type CacheEntry = { at: number; points: CachedPoint[] };

const CACHE_TTL_MS = 30_000;
const MAX_CACHE_POINTS = 8_000;
const agentCache = new Map<string, CacheEntry>();

/**
 * LocalVectorStore — PostgreSQL-backed vector persistence with a short-lived
 * per-worker cache. The cache removes the expensive "load every vector from
 * Postgres" step from hot chat paths while preserving DB as the source of truth.
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

    const existing = agentCache.get(agentId);
    if (existing) {
      const byId = new Map(existing.points.map((point) => [point.id, point]));
      for (const point of points) {
        byId.set(point.id, { id: point.id, vector: point.vector, payload: point.payload });
      }
      agentCache.set(agentId, { at: Date.now(), points: [...byId.values()].slice(-MAX_CACHE_POINTS) });
    }
  }

  private async loadPoints(agentId: string): Promise<CachedPoint[]> {
    const cached = agentCache.get(agentId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.points;

    const total = await db.vectorPoint.count({ where: { agentId } });
    const rows = await db.vectorPoint.findMany({
      where: { agentId },
      select: { id: true, vector: true, payload: true },
    });

    const points: CachedPoint[] = [];
    for (const point of rows.slice(0, MAX_CACHE_POINTS)) {
      try {
        const vector = JSON.parse(point.vector) as number[];
        const payload = JSON.parse(point.payload) as UpsertPoint["payload"];
        if (Array.isArray(vector) && vector.length > 0) {
          points.push({ id: point.id, vector, payload });
        }
      } catch {
        // Ignore corrupted legacy points rather than breaking the whole agent.
      }
    }
    // Only cache bounded agents. Larger agents stay DB-backed so retrieval never
    // silently drops knowledge chunks because of a cache cap.
    if (total <= MAX_CACHE_POINTS) {
      agentCache.set(agentId, { at: Date.now(), points });
    }
    return points;
  }

  async search(agentId: string, queryVector: number[], topK: number): Promise<SearchResult[]> {
    const points = await this.loadPoints(agentId);
    const ranked: SearchResult[] = [];
    for (const point of points) {
      const payload = point.payload;
      if (payload.workspaceId !== undefined && payload.sourceId !== undefined) {
        ranked.push({
          id: point.id,
          score: cosineSimilarity(queryVector, point.vector),
          payload,
        });
      }
    }
    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, Math.max(1, topK));
  }

  async deleteByAgent(agentId: string): Promise<void> {
    await db.vectorPoint.deleteMany({ where: { agentId } });
    agentCache.delete(agentId);
  }

  async deleteBySource(agentId: string, sourceId: string): Promise<void> {
    await db.vectorPoint.deleteMany({ where: { agentId, sourceId } });
    const cached = agentCache.get(agentId);
    if (cached) {
      agentCache.set(agentId, {
        at: Date.now(),
        points: cached.points.filter((point) => point.payload.sourceId !== sourceId),
      });
    }
  }

  async isReady(): Promise<boolean> {
    return true;
  }
}
