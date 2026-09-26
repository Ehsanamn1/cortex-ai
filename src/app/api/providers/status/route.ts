import { applyCors, jsonOk, toErrorResponse } from '@/lib/server/http';
import { requireSession, assertWorkspaceAccess } from '@/lib/server/auth';
import { llmManager } from '@/lib/providers/llm/manager';
import { embeddingManager } from '@/lib/providers/embeddings/manager';
import { vectorStoreStatus } from '@/lib/providers/vector';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const workspaceId = new URL(req.url).searchParams.get('workspaceId') || session.memberships[0]?.workspaceId;
    if (workspaceId) assertWorkspaceAccess(session, workspaceId);

    const llmResult = await Promise.resolve().then(() => llmManager.statusForWorkspace(workspaceId ?? undefined)).catch((error) => {
      console.error('[cortex][providers] LLM status failed:', error);
      return { provider:'none', status:'not_configured' as const, model:null, source:'none' as const };
    });
    const vectorResult = await Promise.resolve().then(() => vectorStoreStatus()).catch((error) => {
      console.error('[cortex][providers] vector status failed:', error);
      return { provider:'local' as const, status:'not_configured' as const };
    });

    const health = workspaceId
      ? await db.agentProviderHealth.findMany({
          where: { workspaceId },
          select: { agentId:true,state:true,consecutiveFailures:true,openedUntil:true,lastCode:true,lastStatus:true,lastLatencyMs:true,lastErrorAt:true,lastSuccessAt:true },
          orderBy: { updatedAt: 'desc' },
        }).catch(() => [])
      : [];
    return applyCors(jsonOk({ llm:llmResult, embeddings:embeddingManager.status(), vectorStore:vectorResult, agentHealth:health }), req.headers.get('origin'));
  } catch(e) {
    return toErrorResponse(e);
  }
}
