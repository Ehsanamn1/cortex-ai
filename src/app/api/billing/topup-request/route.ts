import { db } from "@/lib/db";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const CREDIT_TOP_UP_PACKAGES = {
  starter: { credits: 10_000, amountToman: 1_990_000, label: "۱۰ هزار اعتبار" },
  growth: { credits: 50_000, amountToman: 8_900_000, label: "۵۰ هزار اعتبار" },
  scale: { credits: 100_000, amountToman: 15_900_000, label: "۱۰۰ هزار اعتبار" },
} as const;

export type CreditTopUpPackageKey = keyof typeof CREDIT_TOP_UP_PACKAGES;

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const workspaceId = new URL(req.url).searchParams.get("workspaceId") ?? session.memberships[0]?.workspaceId;
    if (!workspaceId) return jsonError("فضای کاری پیدا نشد.", 404);
    assertWorkspaceAccess(session, workspaceId);

    const requests = await db.creditTopUpRequest.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id:true, packageKey:true, credits:true, amountToman:true, status:true, note:true, createdAt:true, reviewedAt:true },
    });
    return applyCors(jsonOk({
      requests: requests.map(x => ({ ...x, createdAt:x.createdAt.toISOString(), reviewedAt:x.reviewedAt?.toISOString() ?? null })),
      packages: Object.entries(CREDIT_TOP_UP_PACKAGES).map(([key, item]) => ({ key, ...item })),
    }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e, req.headers.get("origin"));
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(req);
    const body = await readJson<Record<string, unknown>>(req);
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : session.memberships[0]?.workspaceId;
    if (!workspaceId) return jsonError("فضای کاری پیدا نشد.", 404);
    assertWorkspaceAccess(session, workspaceId);

    const packageKey = typeof body.packageKey === "string" ? body.packageKey as CreditTopUpPackageKey : "";
    const pack = CREDIT_TOP_UP_PACKAGES[packageKey];
    if (!pack) return jsonError("بسته شارژ معتبر نیست.", 400);

    const recentPending = await db.creditTopUpRequest.count({
      where: { workspaceId, userId: session.user.id, status: "pending", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    if (recentPending >= 3) return jsonError("در ۲۴ ساعت گذشته ۳ درخواست شارژ باز دارید. ابتدا درخواست‌های قبلی تعیین تکلیف شوند.", 429);

    const request = await db.creditTopUpRequest.create({
      data: {
        workspaceId,
        userId: session.user.id,
        packageKey,
        credits: pack.credits,
        amountToman: pack.amountToman,
      },
      select: { id:true, packageKey:true, credits:true, amountToman:true, status:true, createdAt:true },
    });

    return applyCors(jsonOk({ request: { ...request, createdAt:request.createdAt.toISOString() } }, 201), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e, req.headers.get("origin"));
  }
}
