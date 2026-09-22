import { applyCors, jsonOk, toErrorResponse } from '@/lib/server/http';
import { requireSession, assertWorkspaceAccess } from '@/lib/server/auth';
import { llmManager } from '@/lib/providers/llm/manager';
import { embeddingManager } from '@/lib/providers/embeddings/manager';
import { vectorStoreStatus } from '@/lib/providers/vector';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const workspaceId = new URL(req.url).searchParams.get('workspaceId') || session.memberships[0]?.workspaceId;
    if (workspaceId) assertWorkspaceAccess(session, workspaceId);
    const vectorStore = await vectorStoreStatus();
    const llm = await llmManager.statusForWorkspace(workspaceId ?? undefined);
    return applyCors(jsonOk({
      llm,
      embeddings: embeddingManager.status(),
      vectorStore,
    }), req.headers.get('origin'));
  } catch (e) { return toErrorResponse(e); }
}
