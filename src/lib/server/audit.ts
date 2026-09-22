import { db } from '@/lib/db';
export async function audit(workspaceId: string, userId: string | null, action: string, entityType: string, entityId?: string | null, metadata?: unknown) {
  try { await db.auditLog.create({ data: { workspaceId, userId, action, entityType, entityId: entityId ?? null, metadata: metadata ? JSON.stringify(metadata) : null } }); } catch (e) { console.warn('[cortex][audit]', e instanceof Error ? e.message : e); }
}
export function estimateTokens(text: string): number { return Math.max(1, Math.ceil(text.length / 4)); }
