import { randomUUID } from "crypto";

export async function getKnowledgeBucket(): Promise<R2Bucket | null> {
  try {
    const mod = (await import("cloudflare:workers")) as {
      env?: { CORTEX_KNOWLEDGE_BUCKET?: R2Bucket };
    };
    return mod.env?.CORTEX_KNOWLEDGE_BUCKET ?? null;
  } catch {
    return null;
  }
}

export function createKnowledgeObjectKey(agentId: string, sourceId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 160) || "file";
  return "knowledge/" + agentId + "/" + sourceId + "/" + randomUUID() + "-" + safe;
}
