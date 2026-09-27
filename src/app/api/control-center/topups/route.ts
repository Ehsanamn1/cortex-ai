import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/server/admin-auth";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    const status = new URL(req.url).searchParams.get("status");
    const requests = await db.creditTopUpRequest.findMany({
      where: status && ["pending","approved","rejected"].includes(status) ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id:true, workspaceId:true, userId:true, packageKey:true, credits:true, amountToman:true,
        status:true, note:true, createdAt:true, reviewedAt:true, reviewedBy:true,
        workspace:{select:{name:true}},
        user:{select:{name:true,email:true}},
      },
    });
    return applyCors(jsonOk({
      admin,
      requests: requests.map(x => ({
        ...x,
        createdAt:x.createdAt.toISOString(),
        reviewedAt:x.reviewedAt?.toISOString() ?? null,
      })),
    }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const action = typeof body.action === "string" ? body.action : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

    if (!requestId) return jsonError("شناسه درخواست شارژ لازم است.", 400);
    if (action !== "approve" && action !== "reject") return jsonError("عملیات نامعتبر است.", 400);

    const result = await db.$transaction(async (tx) => {
      const request = await tx.creditTopUpRequest.findUnique({
        where: { id: requestId },
        include: { workspace:{select:{id:true,name:true}}, user:{select:{email:true,name:true}} },
      });
      if (!request) throw Object.assign(new Error("درخواست شارژ پیدا نشد."), { status: 404 });
      if (request.status !== "pending") throw Object.assign(new Error("این درخواست قبلاً تعیین تکلیف شده است."), { status: 409 });

      if (action === "reject") {
        const rejected = await tx.creditTopUpRequest.update({
          where: { id: request.id },
          data: { status:"rejected", note: note ?? request.note, reviewedAt:new Date(), reviewedBy:admin },
        });
        return { status:"rejected", request: rejected, credited:0 };
      }

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${request.workspaceId}))`;
      const account = await tx.workspaceBillingAccount.findUnique({ where:{workspaceId:request.workspaceId} });
      if (!account) throw Object.assign(new Error("حساب اعتبار این فضای کاری پیدا نشد."), { status: 404 });

      const idempotencyKey = "topup:" + request.id;
      const existing = await tx.creditLedgerEntry.findUnique({ where:{idempotencyKey} });
      if (existing) {
        const approved = await tx.creditTopUpRequest.update({
          where:{id:request.id},
          data:{status:"approved", note:note ?? request.note, reviewedAt:new Date(), reviewedBy:admin},
        });
        return { status:"approved", request:approved, credited:0 };
      }

      const nextBalance = account.balanceCredits + request.credits;
      await tx.workspaceBillingAccount.update({
        where:{id:account.id},
        data:{balanceCredits:nextBalance,status:"active"},
      });
      const ledger = await tx.creditLedgerEntry.create({
        data:{
          workspaceId:request.workspaceId,
          billingAccountId:account.id,
          amountCredits:request.credits,
          balanceAfter:nextBalance,
          entryType:"top_up",
          referenceType:"credit_top_up_request",
          referenceId:request.id,
          description:"شارژ دستی اعتبار توسط مدیریت",
          metadata:JSON.stringify({amountToman:request.amountToman,packageKey:request.packageKey}),
          idempotencyKey,
        },
      });
      const approved = await tx.creditTopUpRequest.update({
        where:{id:request.id},
        data:{status:"approved", note:note ?? request.note, reviewedAt:new Date(), reviewedBy:admin},
      });
      return { status:"approved", request:approved, credited:ledger.amountCredits, balanceAfter:nextBalance };
    });

    return applyCors(jsonOk({
      ...result,
      request:{...result.request, createdAt:result.request.createdAt.toISOString(), reviewedAt:result.request.reviewedAt?.toISOString() ?? null},
    }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
