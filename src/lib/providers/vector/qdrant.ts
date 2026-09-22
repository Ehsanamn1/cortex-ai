import type { SearchResult, UpsertPoint, VectorStore } from "./types";

/**
 * QdrantVectorStore — real Qdrant REST client.
 * Single collection `cortex_knowledge` (per APP_ENV suffix), points carry
 * agent_id/workspace_id payload indexes; every search/delete is filtered by
 * agent_id so tenant isolation is enforced at the vector DB itself.
 */
export class QdrantVectorStore implements VectorStore {
  readonly name = "qdrant" as const;
  private collection: string;
  private ensured = false;

  constructor(
    private readonly url: string,
    private readonly apiKey?: string
  ) {
    const suffix = process.env.APP_ENV ? `_${process.env.APP_ENV}` : "";
    this.collection = `cortex_knowledge${suffix}`;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h["api-key"] = this.apiKey;
    return h;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const res = await fetch(`${this.url.replace(/\/+$/, "")}${path}`, {
      ...init,
      headers: this.headers(),
      signal: AbortSignal.timeout(30_000),
    });
    return res;
  }

  private async ensureCollection(dims: number): Promise<void> {
    if (this.ensured) return;
    const exists = await this.request(`/collections/${this.collection}`, { method: "GET" });
    if (exists.status === 404) {
      const created = await this.request(`/collections/${this.collection}`, {
        method: "PUT",
        body: JSON.stringify({
          vectors: { size: dims, distance: "Cosine" },
          payload_indexes: [
            { field_name: "agentId", field_schema: "keyword" },
            { field_name: "workspaceId", field_schema: "keyword" },
            { field_name: "sourceId", field_schema: "keyword" },
          ],
        }),
      });
      if (!created.ok) throw new Error(`qdrant create collection failed: ${created.status}`);
    } else if (!exists.ok && exists.status !== 200) {
      throw new Error(`qdrant check collection failed: ${exists.status}`);
    }
    this.ensured = true;
  }

  async upsertPoints(agentId: string, workspaceId: string, points: UpsertPoint[]): Promise<void> {
    if (points.length === 0) return;
    await this.ensureCollection(points[0]!.vector.length);
    const body = {
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: { ...p.payload, agentId, workspaceId },
      })),
    };
    const res = await this.request(`/collections/${this.collection}/points?wait=true`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`qdrant upsert failed: ${res.status}`);
  }

  async search(agentId: string, queryVector: number[], topK: number): Promise<SearchResult[]> {
    await this.ensureCollection(queryVector.length);
    const res = await this.request(`/collections/${this.collection}/points/search`, {
      method: "POST",
      body: JSON.stringify({
        vector: queryVector,
        limit: Math.max(1, topK),
        with_payload: true,
        filter: { must: [{ key: "agentId", match: { value: agentId } }] },
      }),
    });
    if (!res.ok) throw new Error(`qdrant search failed: ${res.status}`);
    const data = (await res.json()) as {
      result?: Array<{ id: string; score: number; payload: Record<string, unknown> }>;
    };
    return (data.result ?? []).map((r) => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload as unknown as UpsertPoint["payload"],
    }));
  }

  async deleteByAgent(agentId: string): Promise<void> {
    const res = await this.request(`/collections/${this.collection}/points/delete?wait=true`, {
      method: "POST",
      body: JSON.stringify({ filter: { must: [{ key: "agentId", match: { value: agentId } }] } }),
    });
    if (!res.ok) throw new Error(`qdrant delete failed: ${res.status}`);
  }

  async deleteBySource(agentId: string, sourceId: string): Promise<void> {
    const res = await this.request(`/collections/${this.collection}/points/delete?wait=true`, {
      method: "POST",
      body: JSON.stringify({
        filter: {
          must: [
            { key: "agentId", match: { value: agentId } },
            { key: "sourceId", match: { value: sourceId } },
          ],
        },
      }),
    });
    if (!res.ok) throw new Error(`qdrant delete failed: ${res.status}`);
  }

  async isReady(): Promise<boolean> {
    try {
      const res = await this.request("/collections", { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }
}
