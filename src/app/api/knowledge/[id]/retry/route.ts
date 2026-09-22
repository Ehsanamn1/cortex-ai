import { db } from "@/lib/db";
import { after } from "next/server";
import { applyCors, jsonError, jsonOk, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { loadAgentForSession } from "@/lib/server/access";
import { isProcessing, processSource } from "@/lib/knowledge/pipeline";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** POST /api/knowledge/:sourceId/retry — re-runs the real processing pipeline. */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const source = await db.knowledgeSource.findUnique({ where: { id }, include: { agent: true } });
    if (!source) {
      return applyCors(jsonError("منبع دانش یافت نشد.", 404), req.headers.get("origin"));
    }
    await loadAgentForSession(session, source.agentId);

    if (isProcessing(source.id)) {
      return applyCors(jsonError("این منبع در حال پردازش است.", 409), req.headers.get("origin"));
    }

    await db.knowledgeSource.update({
      where: { id: source.id },
      data: { status: "pending", error: null },
    });

    after(() => processSource(source.id));
    const updated = await db.knowledgeSource.findUnique({ where: { id: source.id } });
    return applyCors(
      jsonOk(
        {
          source: {
            id: updated!.id,
            name: updated!.name,
            type: updated!.type,
            status: updated!.status,
            error: updated!.error,
            chunkCount: 0,
            createdAt: updated!.createdAt.toISOString(),
            updatedAt: updated!.updatedAt.toISOString(),
            documents: [],
          },
        },
        202
      ),
      req.headers.get("origin")
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
