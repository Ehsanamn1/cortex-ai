import { db } from "@/lib/db";
import { DEFAULT_BILLING_PLANS, getBillingSnapshot } from "@/lib/server/billing";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

function env(name: string): string { return process.env[name]?.trim() ?? ""; }
function zarinpalBase() {
  return env("CORTEX_ZARINPAL_SANDBOX") === "true"
    ? "https://sandbox.zarinpal.com/pg/v4/payment"
    : "https://api.zarinpal.com/pg/v4/payment";
}
function startPayUrl(authority: string) {
  const host = env("CORTEX_ZARINPAL_SANDBOX") === "true" ? "https://sandbox.zarinpal.com" : "https://www.zarinpal.com";
  return host + "/pg/StartPay/" + encodeURIComponent(authority);
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

    const planKey = typeof body.planKey === "string" ? body.planKey : "";
    const plan = DEFAULT_BILLING_PLANS.find((item) => item.key === planKey);
    if (!plan || !["launch", "growth", "scale"].includes(plan.key)) {
      return jsonError("پلن انتخابی برای خرید آنلاین معتبر نیست. Enterprise از مسیر فروش سازمانی فعال می‌شود.", 400);
    }

    await getBillingSnapshot(workspaceId);
    const current = await db.workspaceBillingAccount.findUnique({ where: { workspaceId }, include: { plan: true } });
    if (!current) return jsonError("حساب اعتبار فضای کاری پیدا نشد.", 404);
    if (current.plan.key === plan.key) return jsonError("این پلن در حال حاضر پلن فعال شماست.", 400);

    const existing = await db.creditTopUpRequest.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
        packageKey: "plan:" + plan.key,
        status: "pending",
        paymentStatus: { in: ["initiated", "pending"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing?.paymentAuthority) {
      return applyCors(jsonOk({ redirectUrl: startPayUrl(existing.paymentAuthority), requestId: existing.id }), req.headers.get("origin"));
    }

    const request = await db.creditTopUpRequest.create({
      data: {
        workspaceId,
        userId: session.user.id,
        packageKey: "plan:" + plan.key,
        credits: plan.monthlyCredits,
        amountToman: plan.priceToman,
        status: "pending",
        paymentProvider: "zarinpal",
        paymentStatus: "initiated",
        paymentStartedAt: new Date(),
      },
      select: { id: true, amountToman: true },
    });

    const callbackBase = env("CORTEX_PAYMENT_CALLBACK_URL");
    const callbackUrl = (callbackBase || (new URL(req.url).origin + "/api/billing/plan-payment/callback")) + "?requestId=" + encodeURIComponent(request.id);
    const amountRial = Math.max(10_000, Math.round(request.amountToman * 10));

    const response = await fetch(zarinpalBase() + "/request.json", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        merchant_id: merchantId,
        amount: amountRial,
        description: "Cortex AI plan " + plan.name,
        callback_url: callbackUrl,
        metadata: { email: session.user.email },
      }),
    });
    const data = await response.json().catch(() => null) as any;
    const authority = data?.data?.authority as string | undefined;
    const code = Number(data?.data?.code ?? data?.code ?? -1);
    if (!response.ok || !authority || ![100, 101].includes(code)) {
      await db.creditTopUpRequest.update({
        where: { id: request.id },
        data: { paymentStatus: "failed", note: "zarinpal_plan_request_failed:" + String(code) },
      });
      return jsonError("ایجاد پرداخت پلن ناموفق بود. دوباره تلاش کنید.", 502);
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
