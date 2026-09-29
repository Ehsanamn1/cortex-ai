import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_BILLING_PLANS } from "@/lib/server/billing";

export const dynamic = "force-dynamic";

function env(name: string): string { return process.env[name]?.trim() ?? ""; }
function zarinpalBase() {
  return env("CORTEX_ZARINPAL_SANDBOX") === "true"
    ? "https://sandbox.zarinpal.com/pg/v4/payment"
    : "https://api.zarinpal.com/pg/v4/payment";
}
function customerRedirect(req: Request, result: "success" | "cancelled" | "failed") {
  const base = env("CORTEX_CUSTOMER_APP_URL") || new URL(req.url).origin;
  return NextResponse.redirect(base + "/control-center?view=billing&planPayment=" + result);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requestId = url.searchParams.get("requestId") ?? "";
  const authority = url.searchParams.get("Authority") ?? url.searchParams.get("authority") ?? "";
  const status = (url.searchParams.get("Status") ?? url.searchParams.get("status") ?? "").toUpperCase();
  if (!requestId || !authority) return customerRedirect(req, "failed");

  const request = await db.creditTopUpRequest.findUnique({ where: { id: requestId } });
  if (!request || request.paymentAuthority !== authority || !request.packageKey.startsWith("plan:")) return customerRedirect(req, "failed");
  if (request.paymentStatus === "paid" || request.status === "approved") return customerRedirect(req, "success");
  if (status !== "OK") {
    await db.creditTopUpRequest.updateMany({
      where: { id: request.id, paymentStatus: { not: "paid" } },
      data: { paymentStatus: "cancelled", status: "rejected", note: "customer_cancelled" },
    });
    return customerRedirect(req, "cancelled");
  }

  const merchantId = env("CORTEX_ZARINPAL_MERCHANT_ID");
  if (!merchantId) return customerRedirect(req, "failed");
  const amountRial = Math.max(10_000, Math.round(request.amountToman * 10));
  const verifyResponse = await fetch(zarinpalBase() + "/verify.json", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ merchant_id: merchantId, amount: amountRial, authority }),
  });
  const verifyData = await verifyResponse.json().catch(() => null) as any;
  const code = Number(verifyData?.data?.code ?? verifyData?.code ?? -1);
  const refId = verifyData?.data?.ref_id != null ? String(verifyData.data.ref_id) : null;
  if (!verifyResponse.ok || ![100, 101].includes(code)) {
    await db.creditTopUpRequest.updateMany({
      where: { id: request.id, paymentStatus: { not: "paid" } },
      data: { paymentStatus: "failed", note: "zarinpal_plan_verify_failed:" + String(code) },
    });
    return customerRedirect(req, "failed");
  }

  const planKey = request.packageKey.slice("plan:".length);
  const plan = DEFAULT_BILLING_PLANS.find((item) => item.key === planKey);
  if (!plan) return customerRedirect(req, "failed");

  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${request.workspaceId}))`;
      const fresh = await tx.creditTopUpRequest.findUniqueOrThrow({ where: { id: request.id } });
      if (fresh.paymentStatus === "paid" || fresh.status === "approved") return;

      const account = await tx.workspaceBillingAccount.findUnique({ where: { workspaceId: fresh.workspaceId } });
      if (!account) throw new Error("billing account missing");
      const target = await tx.plan.findUniqueOrThrow({ where: { key: plan.key } });
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const nextBalance = target.monthlyCredits;
      const balanceDelta = nextBalance - account.balanceCredits;
      await tx.workspaceBillingAccount.update({
        where: { id: account.id },
        data: {
          planId: target.id,
          balanceCredits: nextBalance,
          status: "active",
          enforcementEnabled: true,
          periodStart: now,
          periodEnd,
        },
      });
      await tx.subscription.updateMany({
        where: { billingAccountId: account.id, status: "active" },
        data: { status: "cancelled", cancelAtPeriodEnd: false, updatedAt: now },
      });
      await tx.subscription.create({
        data: {
          workspaceId: fresh.workspaceId,
          billingAccountId: account.id,
          planId: target.id,
          status: "active",
          provider: "zarinpal",
          externalId: fresh.id,
          periodStart: now,
          periodEnd,
        },
      });

      const idempotencyKey = "plan-purchase:" + fresh.id;
      await tx.creditLedgerEntry.create({
        data: {
          workspaceId: fresh.workspaceId,
          billingAccountId: account.id,
          amountCredits: balanceDelta,
          balanceAfter: nextBalance,
          entryType: "plan_activation",
          referenceType: "credit_top_up_request",
          referenceId: fresh.id,
          description: "فعال‌سازی پلن " + target.name,
          metadata: JSON.stringify({ planKey: target.key, amountToman: fresh.amountToman, paymentProvider: "zarinpal", authority, paymentRefId: refId }),
          idempotencyKey,
        },
      });

      await tx.creditTopUpRequest.update({
        where: { id: fresh.id },
        data: {
          status: "approved",
          paymentStatus: "paid",
          paymentRefId: refId,
          paidAt: now,
          reviewedAt: now,
          reviewedBy: "gateway:zarinpal",
        },
      });

      const invoiceNumber = "PLAN-" + fresh.id;
      await tx.invoice.upsert({
        where: { invoiceNumber },
        update: { status: "paid", paidAt: now, totalToman: fresh.amountToman, subtotalToman: fresh.amountToman },
        create: {
          workspaceId: fresh.workspaceId,
          billingAccountId: account.id,
          invoiceNumber,
          status: "paid",
          currency: "TOMAN",
          periodStart: now,
          periodEnd,
          subtotalToman: fresh.amountToman,
          overageToman: 0,
          totalToman: fresh.amountToman,
          issuedAt: now,
          paidAt: now,
          metadata: JSON.stringify({ type: "plan_purchase", planKey: target.key, requestId: fresh.id, paymentProvider: "zarinpal", paymentRefId: refId }),
        },
      });
    });
  } catch {
    return customerRedirect(req, "failed");
  }

  return customerRedirect(req, "success");
}
