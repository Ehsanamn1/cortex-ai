import { NextResponse } from "next/server";
import { getBillingSnapshot } from "@/lib/server/billing";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
import { toErrorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const requested = new URL(req.url).searchParams.get("workspaceId");
    const workspaceId = requested ?? session.memberships[0]?.workspaceId;
    if (!workspaceId) return NextResponse.json({ error: "فضای کاری پیدا نشد." }, { status: 404 });
    assertWorkspaceAccess(session, workspaceId);
    return NextResponse.json(await getBillingSnapshot(workspaceId), {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    return toErrorResponse(error, req.headers.get("origin"));
  }
}
