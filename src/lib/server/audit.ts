import { db } from "@/lib/db";

export interface AuditInput {
  workspaceId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: unknown;
}

export async function audit(input: AuditInput): Promise<void>;
export async function audit(
  workspaceId: string,
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: unknown,
): Promise<void>;
export async function audit(
  inputOrWorkspaceId: AuditInput | string,
  userId?: string | null,
  action?: string,
  entityType?: string,
  entityId?: string | null,
  metadata?: unknown,
): Promise<void> {
  const input: AuditInput =
    typeof inputOrWorkspaceId === "string"
      ? {
          workspaceId: inputOrWorkspaceId,
          userId: userId ?? null,
          action: action ?? "unknown",
          entityType: entityType ?? "unknown",
          entityId,
          metadata,
        }
      : inputOrWorkspaceId;

  try {
    await db.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (e) {
    console.warn("[cortex][audit]", e instanceof Error ? e.message : e);
  }
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
