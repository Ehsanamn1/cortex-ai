import { db } from "@/lib/db";
export async function loadAgentMemory(agentId: string, limit = 12) { return db.memoryEntry.findMany({ where: { agentId }, orderBy: { updatedAt: "desc" }, take: Math.min(50, Math.max(1, limit)) }); }
export async function remember(params: { workspaceId: string; agentId: string; conversationId?: string; key: string; value: string; type?: string; metadata?: unknown; }) {
  const id = params.agentId + ":" + params.key;
  return db.memoryEntry.upsert({ where: { id }, update: { value: params.value, conversationId: params.conversationId ?? null, type: params.type ?? "fact", metadata: params.metadata ? JSON.stringify(params.metadata) : null }, create: { id, workspaceId: params.workspaceId, agentId: params.agentId, conversationId: params.conversationId ?? null, key: params.key, value: params.value, type: params.type ?? "fact", metadata: params.metadata ? JSON.stringify(params.metadata) : null } });
}
