import { db } from "@/lib/db";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { activateFreePlan, getBillingSummary } from "@/lib/server/billing";

export const dynamic = "force-dynamic";

function workspaceFromRequest(session: Awaited<ReturnType<typeof requireSession>>, req: Request) {
  const requested = new URL(req.url).searchParams.get("workspaceId");
  const workspaceId = requested ?? session.memberships[0]?.workspaceId;
  if (!workspaceId) throw Object.assign(new Error("فضای کاری فعالی برای این حساب وجود ندارد."), { status: 400 });
  assertWorkspaceAccess(session, workspaceId);
  return workspaceId;
}

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const workspaceId = workspaceFromRequest(session, req);
    const billing = await getBillingSummary(workspaceId);
    return applyCors(jsonOk({ workspaceId, billing }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e, req.headers.get("origin"));
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(req);
    const workspaceId = workspaceFromRequest(session, req);
    const body = await readJson<{ action?: string; planKey?: string }>(req);

    if (body.action === "activate_plan" && body.planKey === "free") {
      await activateFreePlan(workspaceId);
      const billing = await getBillingSummary(workspaceId);
      return applyCors(jsonOk({ workspaceId, billing }), req.headers.get("origin"));
    }

    if (body.action === "activate_plan" && body.planKey) {
      const plan = await db.plan.findUnique({ where: { key: body.planKey } });
      if (!plan || !plan.active) {
        return applyCors(jsonError("این پلن در دسترس نیست.", 404), req.headers.get("origin"));
      }
      return applyCors(
        jsonError("فعال‌سازی پلن پولی تا اتصال درگاه پرداخت عمداً غیرفعال است.", 501),
        req.headers.get("origin"),
      );
    }

    return applyCors(jsonError("عملیات صورتحساب معتبر نیست.", 400), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e, req.headers.get("origin"));
  }
}
