import { QdrantVectorStore } from "./qdrant";
import { LocalVectorStore } from "./local";
import type { VectorStore, SearchResult } from "./types";
export type { SearchResult } from "./types";

/**
 * Picks the vector store:
 * - QDRANT_URL configured → QdrantVectorStore (with live readiness probe).
 * - otherwise → LocalVectorStore (PostgreSQL; always ready).
 */
export function getVectorStore(): VectorStore {
  const url = process.env.QDRANT_URL?.trim();
  if (url) {
    return new QdrantVectorStore(url, process.env.QDRANT_API_KEY?.trim() || undefined);
  }
  return new LocalVectorStore();
}

export async function vectorStoreStatus(): Promise<{
  provider: "local" | "qdrant";
  status: "ready" | "not_configured";
}> {
  const store = getVectorStore();
  if (store.name === "local") return { provider: "local", status: "ready" };
  const ready = await store.isReady();
  return { provider: "qdrant", status: ready ? "ready" : "not_configured" };
}
