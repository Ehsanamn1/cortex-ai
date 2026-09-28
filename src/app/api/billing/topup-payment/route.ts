import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CREDIT_TOP_UP_PACKAGES, type CreditTopUpPackageKey } from "@/lib/server/billing";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function zarinpalBase() {
  return env("CORTEX_ZARINPAL_SANDBOX") === "true"
    ? "https://sandbox.zarinpal.com/pg/v4/payment"
    : "https://api.zarinpal.com/pg/v4/payment";
}

function startPayUrl(authority: string) {
  const host = env("CORTEX_ZARINPAL_SANDBOX") === "true" ? "https://sandbox.zarinpal.com" : "https://www.zarinpal.com";
  return host + "/pg/StartPay/" + encodeURIComponent(authority);
}

function originFromRequest(req: Request): string {
  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  try {
    const merchantId = env("CORTEX_ZARINPAL_MERCHANT_ID");
    if (!merchantId) return jsonError("درگاه پرداخت هنوز پیکربندی نشده است.", 503);

    const session = await requireSession(req);
    const body = await readJson<Record<string, unknown>>(req);
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : session.memberships[0]?.workspaceId;
    if (!workspaceId) return jsonError("فضای کاری پیدا نشد.", 404);
    assertWorkspaceAccess(session, workspaceId);

    const packageKey = typeof body.packageKey === "string" ? body.packageKey as CreditTopUpPackageKey : "";
    const pack = CREDIT_TOP_UP_PACKAGES[packageKey];
    if (!pack) return jsonError("بسته شارژ معتبر نیست.", 400);

    const recentPending = await db.creditTopUpRequest.findFirst({
      where: { workspaceId, userId: session.user.id, status: "pending", paymentStatus: { in: ["initiated", "pending"] } },
      orderBy: { createdAt: "desc" },
    });
    if (recentPending && recentPending.paymentAuthority) {
      return applyCors(jsonOk({ redirectUrl: startPayUrl(recentPending.paymentAuthority), requestId: recentPending.id }), req.headers.get("origin"));
    }

    const request = await db.creditTopUpRequest.create({
      data: {
        workspaceId,
        userId: session.user.id,
        packageKey,
        credits: pack.credits,
        amountToman: pack.amountToman,
        status: "pending",
        paymentProvider: "zarinpal",
        paymentStatus: "initiated",
        paymentStartedAt: new Date(),
      },
      select: { id:true, amountToman:true },
    });

    const callbackBase = env("CORTEX_PAYMENT_CALLBACK_URL");
    const callbackUrl = (callbackBase || (originFromRequest(req) + "/api/billing/topup-payment/callback")) + "?requestId=" + encodeURIComponent(request.id);
    const amountRial = Math.max(10_000, Math.round(request.amountToman * 10));

    const response = await fetch(zarinpalBase() + "/request.json", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        merchant_id: merchantId,
        amount: amountRial,
        description: "Cortex AI credit top-up",
        callback_url: callbackUrl,
        metadata: { email: session.user.email, mobile: "" },
      }),
    });
    const data = await response.json().catch(() => null) as any;
    const authority = data?.data?.authority as string | undefined;
    const code = Number(data?.data?.code ?? data?.code ?? -1);
    if (!response.ok || !authority || ![100, 101].includes(code)) {
      await db.creditTopUpRequest.update({
        where: { id: request.id },
        data: { paymentStatus: "failed", note: "zarinpal_request_failed:" + String(code) },
      });
      return jsonError("ایجاد پرداخت ناموفق بود. دوباره تلاش کنید.", 502);
    }

    await db.creditTopUpRequest.update({
      where: { id: request.id },
      data: { paymentAuthority: authority, paymentStatus: "pending" },
    });

    return applyCors(jsonOk({ redirectUrl: startPayUrl(authority), requestId: request.id }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e, req.headers.get("origin"));
  }
}
