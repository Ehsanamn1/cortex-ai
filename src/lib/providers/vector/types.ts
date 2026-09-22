/**
 * VectorStore abstraction. Two real adapters:
 * - LocalVectorStore: SQLite (VectorPoint table) + in-process cosine search.
 * - QdrantVectorStore: full REST client (collections, upsert, filtered
 *   search, delete-by-filter) used when QDRANT_URL is configured.
 *
 * Tenant isolation is enforced by the mandatory agentId + workspaceId
 * filters on every operation.
 */

export interface UpsertPoint {
  id: string;
  vector: number[];
  payload: {
    chunkId: string;
    text: string;
    documentName: string;
    page?: number | null;
    section?: string | null;
    sourceUrl?: string | null;
    seq: number;
    sourceId: string;
    documentId: string;
    workspaceId: string;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  payload: UpsertPoint["payload"];
}

export interface VectorStore {
  readonly name: "local" | "qdrant";
  upsertPoints(agentId: string, workspaceId: string, points: UpsertPoint[]): Promise<void>;
  search(agentId: string, queryVector: number[], topK: number): Promise<SearchResult[]>;
  deleteByAgent(agentId: string): Promise<void>;
  deleteBySource(agentId: string, sourceId: string): Promise<void>;
  isReady(): Promise<boolean>;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
