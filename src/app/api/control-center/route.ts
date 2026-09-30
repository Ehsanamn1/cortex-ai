import { db } from "@/lib/db";
import { applyCors, jsonOk, toErrorResponse } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getUsdTomanRate } from "@/lib/server/fx";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [users, workspaces, agents, knowledge, conversations, messages, bots, providers, events, logs, recentAgents, recentUsers, recentConversations, usage30, usageModels, billingAccounts, activeSubscriptions, billedCredits30, bookedPlanValue, usdTomanRate, dailyRevenueRows, dailyProviderCostRows] = await Promise.all([
      db.user.count(),
      db.workspace.count(),
      db.agent.count(),
      db.knowledgeSource.count(),
      db.conversation.count(),
      db.message.count(),
      db.telegramBot.count(),
      db.providerConfig.count({ where: { enabled: true } }),
      db.usageEvent.count(),
      db.auditLog.count(),
      db.agent.findMany({ take: 8, orderBy: { createdAt: "desc" }, select: { id:true,name:true,status:true,createdAt:true,workspace:{select:{name:true}} } }),
      db.user.findMany({ take: 8, orderBy: { createdAt: "desc" }, select: { id:true,name:true,email:true,createdAt:true } }),
      db.conversation.findMany({ take: 8, orderBy: { updatedAt: "desc" }, select: { id:true,title:true,channel:true,updatedAt:true,agent:{select:{name:true}} } }),
      db.usageEvent.aggregate({ where: { createdAt: { gte: since30 } }, _sum: { totalTokens: true, estimatedCostMicros: true } }),
      db.usageEvent.groupBy({ by: ["provider", "model", "channel"], where: { createdAt: { gte: since30 } }, _sum: { totalTokens: true, estimatedCostMicros: true }, _count: { _all: true } }),
      db.workspaceBillingAccount.count(),
      db.subscription.count({ where: { status: "active" } }),
      db.billingCharge.aggregate({ where: { createdAt: { gte: since30 }, status: { in: ["captured", "captured_debt"] } }, _sum: { chargedCredits: true, providerCostMicros: true } }),
      db.subscription.findMany({ where: { status: "active", plan: { priceToman: { gt: 0 } } }, select: { plan: { select: { priceToman: true } } } }).then(rows => rows.reduce((sum, row) => sum + row.plan.priceToman, 0)),
      getUsdTomanRate(),
      db.$queryRawUnsafe<Array<{ day: Date; revenue: bigint }>>("SELECT date_trunc('day', \"createdAt\") AS day, COALESCE(SUM(\"amountToman\"), 0)::bigint AS revenue FROM \"CreditTopUpRequest\" WHERE \"paidAt\" IS NOT NULL AND \"createdAt\" >= NOW() - INTERVAL '30 days' GROUP BY 1 ORDER BY 1 ASC"),
      db.$queryRawUnsafe<Array<{ day: Date; costMicros: bigint }>>("SELECT date_trunc('day', \"createdAt\") AS day, COALESCE(SUM(\"providerCostMicros\"), 0)::bigint AS \"costMicros\" FROM \"BillingCharge\" WHERE \"status\" IN ('captured', 'captured_debt') AND \"createdAt\" >= NOW() - INTERVAL '30 days' GROUP BY 1 ORDER BY 1 ASC"),
    ]);

    const cashRevenueToman = dailyRevenueRows.reduce((sum, row) => sum + Number(row.revenue), 0);
    const providerCostToman = Math.round((billedCredits30._sum.providerCostMicros ?? 0) / 1_000_000 * usdTomanRate.usdToman);
    const grossMarginToman = cashRevenueToman - providerCostToman;
    return applyCors(jsonOk({
      admin,
      metrics: { users, workspaces, agents, knowledge, conversations, messages, bots, providers, events, logs },
      recentAgents: recentAgents.map((x) => ({ ...x, createdAt:x.createdAt.toISOString() })),
      recentUsers: recentUsers.map((x) => ({ ...x, createdAt:x.createdAt.toISOString() })),
      recentConversations: recentConversations.map((x) => ({ ...x, updatedAt:x.updatedAt.toISOString() })),
      usageSummary: {
        last30Days: { tokens: usage30._sum.totalTokens ?? 0, estimatedCostMicros: usage30._sum.estimatedCostMicros ?? 0 },
        models: usageModels
          .map((row) => ({
            provider: row.provider ?? "unknown",
            model: row.model ?? "unknown",
            channel: row.channel,
            tokens: row._sum.totalTokens ?? 0,
            estimatedCostMicros: row._sum.estimatedCostMicros ?? 0,
            events: row._count._all,
          }))
          .sort((a, b) => b.estimatedCostMicros - a.estimatedCostMicros)
          .slice(0, 12),
      },
      financial: {
        billingAccounts,
        activeSubscriptions,
        usdTomanRate: usdTomanRate.usdToman,
        usdTomanRateSource: usdTomanRate.source,
        last30Days: {
          creditsConsumed: billedCredits30._sum.chargedCredits ?? 0,
          providerCostMicros: billedCredits30._sum.providerCostMicros ?? 0,
          providerCostToman: Math.round((billedCredits30._sum.providerCostMicros ?? 0) / 1_000_000 * usdTomanRate.usdToman),
          bookedMonthlyPlanValueToman: bookedPlanValue,
          cashRevenueToman,
          grossMarginToman,
        },
        daily: {
          revenue: dailyRevenueRows.map((row) => ({ day: row.day.toISOString(), revenueToman: Number(row.revenue) })),
          providerCost: dailyProviderCostRows.map((row) => ({ day: row.day.toISOString(), costToman: Math.round(Number(row.costMicros) / 1_000_000 * usdTomanRate.usdToman) })),
        },
        note: "درآمد نمودار از پرداخت‌های ثبت‌شده اعتبار است؛ هزینه تأمین مدل از BillingCharge محاسبه می‌شود و نرخ ارز منبع در همان پاسخ ثبت شده است.",
      },
    }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
