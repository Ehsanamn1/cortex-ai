import { db } from "@/lib/db";
import { applyCors, jsonOk, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { loadAgentForSession } from "@/lib/server/access";
import { deleteSourceCompletely } from "@/lib/knowledge/pipeline";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/knowledge/:sourceId — removes rows, chunks, vectors and the stored upload. */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const source = await db.knowledgeSource.findUnique({ where: { id }, include: { agent: true } });
    if (!source) {
      const err = new Error("منبع دانش یافت نشد.");
      (err as Error & { status?: number }).status = 404;
      throw err;
    }
    // Reuse agent-scoped authorization before deleting anything.
    await loadAgentForSession(session, source.agentId);
    await deleteSourceCompletely(source.id);
    return applyCors(jsonOk({ ok: true }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
