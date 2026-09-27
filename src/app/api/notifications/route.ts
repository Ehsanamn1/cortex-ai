import { db } from "@/lib/db";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
import { applyCors, jsonError, jsonOk, toErrorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const workspaceId = new URL(req.url).searchParams.get("workspaceId") ?? session.memberships[0]?.workspaceId;
    if (!workspaceId) return jsonError("فضای کاری پیدا نشد.", 404);
    assertWorkspaceAccess(session, workspaceId);

    const activity = await db.auditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id:true, action:true, entityType:true, createdAt:true },
    });

    return applyCors(jsonOk({
      notifications: activity.map(item => ({
        id:item.id,
        action:item.action,
        entityType:item.entityType,
        createdAt:item.createdAt.toISOString(),
      })),
    }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e, req.headers.get("origin"));
  }
}
