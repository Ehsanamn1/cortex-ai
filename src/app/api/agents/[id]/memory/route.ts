import { db } from "@/lib/db";
import { assertWorkspaceAccess, requireSession } from "@/lib/server/auth";
import { applyCors, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { forgetMemory, loadAgentMemory } from "@/lib/runtime/memory";
import { loadAgentForSession } from "@/lib/server/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const agent = await loadAgentForSession(session, (await params).id);
    assertWorkspaceAccess(session, agent.workspaceId);
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "24") || 24));
    const conversationId = url.searchParams.get("conversationId");
    const subjectKey = url.searchParams.get("subjectKey");
    const entries = await loadAgentMemory(agent.id, limit, conversationId, subjectKey);
    return applyCors(jsonOk({
      memories: entries.map((m) => ({
        id: m.id,
        scope: m.scope,
        subjectKey: m.subjectKey,
        conversationId: m.conversationId,
        type: m.type,
        key: m.key,
        value: m.value,
        importance: m.importance,
        confidence: m.confidence,
        source: m.source,
        expiresAt: m.expiresAt?.toISOString() ?? null,
        updatedAt: m.updatedAt.toISOString(),
        lastAccessedAt: m.lastAccessedAt.toISOString(),
      })),
    }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const agent = await loadAgentForSession(session, (await params).id);
    const membership = assertWorkspaceAccess(session, agent.workspaceId);
    if (!["owner", "admin"].includes(membership.role)) {
      throw Object.assign(new Error("دسترسی ویرایش حافظه را ندارید."), { status: 403 });
    }
    const body = await readJson<Record<string, unknown>>(req);
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) throw Object.assign(new Error("شناسه حافظه الزامی است."), { status: 400 });

    const existing = await db.memoryEntry.findFirst({
      where: { id, agentId: agent.id, workspaceId: agent.workspaceId },
    });
    if (!existing) throw Object.assign(new Error("حافظه پیدا نشد."), { status: 404 });

    const data: Record<string, unknown> = {};
    for (const key of ["value", "type", "source"] as const) {
      if (typeof body[key] === "string") {
        data[key] = String(body[key]).trim().slice(0, 2000);
      }
    }
    if (typeof body.importance === "number") data.importance = Math.max(0, Math.min(100, Math.floor(body.importance)));
    if (typeof body.confidence === "number") data.confidence = Math.max(0, Math.min(100, Math.floor(body.confidence)));
    if (typeof body.expiresAt === "string" && body.expiresAt.trim()) {
      const date = new Date(body.expiresAt);
      if (Number.isNaN(date.getTime())) {
        throw Object.assign(new Error("تاریخ انقضا نامعتبر است."), { status: 400 });
      }
      data.expiresAt = date;
    }
    if (body.expiresAt === null) data.expiresAt = null;
    data.lastAccessedAt = new Date();

    const updated = await db.memoryEntry.update({ where: { id: existing.id }, data: data as any });
    return applyCors(jsonOk({ memory: {
      id: updated.id, scope: updated.scope, subjectKey: updated.subjectKey,
      conversationId: updated.conversationId, type: updated.type, key: updated.key,
      value: updated.value, importance: updated.importance, confidence: updated.confidence,
      source: updated.source, expiresAt: updated.expiresAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(), lastAccessedAt: updated.lastAccessedAt.toISOString(),
    }}), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const agent = await loadAgentForSession(session, (await params).id);
    const membership = assertWorkspaceAccess(session, agent.workspaceId);
    if (!["owner", "admin"].includes(membership.role)) {
      throw Object.assign(new Error("دسترسی حذف حافظه را ندارید."), { status: 403 });
    }
    const url = new URL(req.url);
    const body = await readJson<Record<string, unknown>>(req).catch(() => ({}));
    const deleted = await forgetMemory({
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      key: typeof body.key === "string" ? body.key : url.searchParams.get("key") ?? undefined,
      subjectKey: typeof body.subjectKey === "string" ? body.subjectKey : url.searchParams.get("subjectKey") ?? undefined,
      conversationId: typeof body.conversationId === "string" ? body.conversationId : url.searchParams.get("conversationId") ?? undefined,
    });
    return applyCors(jsonOk({ deleted: deleted.count }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
