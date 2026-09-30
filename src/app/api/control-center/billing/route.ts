import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin-auth";
import { defaultCreditMultiplierBps } from "@/lib/server/billing";
import { getUsdTomanRate } from "@/lib/server/fx";

export const dynamic = "force-dynamic";

function intValue(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < min || i > max) return null;
  return i;
}

function floatValue(value: unknown, min = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min ? n : null;
}

function textValue(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : null;
}

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const [plans, models, systemProviders, accounts, invoices, recentCharges, fx] = await Promise.all([
      db.plan.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          modelAccess: { include: { modelCatalog: true } },
          _count: { select: { billingAccounts: true, subscriptions: true } },
        },
      }),
      db.modelCatalog.findMany({
        orderBy: [{ provider: "asc" }, { displayName: "asc" }],
        include: {
          systemProvider: { select: { id: true, key: true, displayName: true, providerName: true, protocol: true, baseUrl: true, enabled: true, isTrialProvider: true } },
          planAccess: { include: { plan: { select: { id: true, key: true, name: true } } } },
        },
      }),
      db.systemProviderConfig.findMany({
        orderBy: [{ isTrialProvider: "desc" }, { enabled: "desc" }, { updatedAt: "desc" }],
        select: { id:true, key:true, displayName:true, providerName:true, protocol:true, authMode:true, baseUrl:true, enabled:true, isTrialProvider:true, lastHealthStatus:true, lastHealthError:true, lastHealthAt:true },
      }),
      db.workspaceBillingAccount.findMany({
        take: 100,
        orderBy: { updatedAt: "desc" },
        include: {
          workspace: { select: { id: true, name: true, owner: { select: { name: true, email: true } } } },
          plan: { select: { id: true, key: true, name: true, priceToman: true, monthlyCredits: true } },
          _count: { select: { charges: true, ledgerEntries: true, invoices: true, reservations: true } },
        },
      }),
      db.invoice.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
        include: { workspace: { select: { id: true, name: true } } },
      }),
      db.billingCharge.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, workspaceId: true, provider: true, model: true,
          providerCostMicros: true, creditMultiplierBps: true, chargedCredits: true,
          status: true, createdAt: true, usageEventId: true,
          workspace: { select: { name: true } },
        },
      }),
      getUsdTomanRate(),
    ]);

    return applyCors(jsonOk({
      fx,
      plans,
      models,
      systemProviders,
      accounts,
      invoices,
      recentCharges,
      defaults: { economy: 100, balanced: 200, premium: 400, deep: 800 },
    }), req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const action = textValue(body.action, 40);

    if (action === "create_plan") {
      const key = textValue(body.key, 80)?.toLowerCase();
      const name = textValue(body.name, 120);
      const description = textValue(body.description, 500);
      const priceToman = intValue(body.priceToman, 0, 2_000_000_000);
      const monthlyCredits = intValue(body.monthlyCredits, 0, 10_000_000_000);
      const overageCreditPriceToman = intValue(body.overageCreditPriceToman, 0, 10_000_000);
      const sortOrder = intValue(body.sortOrder, 0, 10000);
      if (!key || !/^[a-z0-9][a-z0-9._-]{1,79}$/.test(key) || !name || priceToman == null || monthlyCredits == null || overageCreditPriceToman == null || sortOrder == null) {
        return applyCors(jsonError("اطلاعات پلن معتبر نیست.", 400), req.headers.get("origin"));
      }
      const plan = await db.plan.create({
        data: { key, name, description: description || null, priceToman, currency: "TOMAN", monthlyCredits, overageCreditPriceToman, sortOrder, active: body.active !== false },
      });
      return applyCors(jsonOk({ admin, plan }, 201), req.headers.get("origin"));
    }

    if (action === "create_model") {
      const provider = textValue(body.provider, 80);
      const modelId = textValue(body.modelId, 180);
      const displayName = textValue(body.displayName, 180);
      const inputUsdPer1M = floatValue(body.inputUsdPer1M);
      const outputUsdPer1M = floatValue(body.outputUsdPer1M);
      const qualityTier = textValue(body.qualityTier, 40) || "balanced";
      const speedTier = textValue(body.speedTier, 40) || "balanced";
      const routeKey = textValue(body.routeKey, 100)?.toLowerCase() || null;
      const systemProviderId = textValue(body.systemProviderId, 120) || null;
      const boundProvider = systemProviderId
        ? await db.systemProviderConfig.findUnique({ where: { id: systemProviderId }, select: { id: true, enabled: true, apiKeyEncrypted: true, authMode: true } })
        : null;
      if (systemProviderId && !boundProvider) {
        return applyCors(jsonError("Provider زیرساخت پیدا نشد.", 404), req.headers.get("origin"));
      }
      if (body.trialDefault === true && (!boundProvider?.enabled || (!boundProvider.apiKeyEncrypted && boundProvider.authMode !== "none"))) {
        return applyCors(jsonError("مدل Trial Default باید به یک Provider فعال و پیکربندی‌شده متصل باشد.", 400), req.headers.get("origin"));
      }
      if (routeKey && !/^[a-z0-9][a-z0-9._-]{1,99}$/.test(routeKey)) {
        return applyCors(jsonError("Route Key مدل معتبر نیست.", 400), req.headers.get("origin"));
      }
      if (!provider || !modelId || !displayName || inputUsdPer1M == null || outputUsdPer1M == null) {
        return applyCors(jsonError("اطلاعات مدل معتبر نیست.", 400), req.headers.get("origin"));
      }
      const model = await db.$transaction(async (tx) => {
        if (body.trialDefault === true) {
          await tx.modelCatalog.updateMany({ where: { trialDefault: true }, data: { trialDefault: false } });
        }
        const model = await tx.modelCatalog.create({
          data: {
            routeKey,
            provider, modelId, displayName, inputUsdPer1M, outputUsdPer1M,
          contextWindow: intValue(body.contextWindow, 0, 10_000_000) ?? null,
          vision: body.vision === true, tools: body.tools === true, structuredOutput: body.structuredOutput === true,
          reasoning: body.reasoning === true, qualityTier, speedTier,
          commercialAvailable: body.commercialAvailable !== false, active: body.active !== false,
          trialEnabled: body.trialEnabled === true,
          trialDefault: body.trialDefault === true,
          systemProviderId,
        },
      });
      const effectiveTrial = body.trialDefault === true || body.trialEnabled === true;
      if (effectiveTrial) {
        const free = await tx.plan.findUnique({ where: { key: "free" }, select: { id: true } });
        if (free) {
          await tx.planModelAccess.upsert({
            where: { planId_modelCatalogId: { planId: free.id, modelCatalogId: model.id } },
            update: { enabled: true },
            create: { planId: free.id, modelCatalogId: model.id, enabled: true, creditMultiplierBps: 100 },
          });
        }
      }
      return model;
      });
      return applyCors(jsonOk({ admin, model }, 201), req.headers.get("origin"));
    }

    return applyCors(jsonError("عملیات billing پشتیبانی نمی‌شود.", 400), req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const action = textValue(body.action, 40);
    const id = textValue(body.id, 120);

    if (action === "update_plan" && id) {
      const data: Record<string, unknown> = {};
      for (const [key, min, max] of [["priceToman",0,2_000_000_000],["monthlyCredits",0,10_000_000_000],["overageCreditPriceToman",0,10_000_000],["sortOrder",0,10000]] as const) {
        if (body[key] !== undefined) {
          const value = intValue(body[key], min, max);
          if (value == null) return applyCors(jsonError("مقدار عددی پلن نامعتبر است.", 400), req.headers.get("origin"));
          data[key] = value;
        }
      }
      for (const key of ["name","description"] as const) if (body[key] !== undefined) {
        const value = textValue(body[key], key === "name" ? 120 : 500);
        if (key === "name" && !value) return applyCors(jsonError("نام پلن الزامی است.", 400), req.headers.get("origin"));
        data[key] = value || null;
      }
      if (typeof body.active === "boolean") data.active = body.active;
      const plan = await db.plan.update({ where: { id }, data });
      return applyCors(jsonOk({ admin, plan }), req.headers.get("origin"));
    }

    if (action === "update_model" && id) {
      const data: Record<string, unknown> = {};
      if (body.routeKey !== undefined) {
        const value = textValue(body.routeKey, 100)?.toLowerCase();
        if (value && !/^[a-z0-9][a-z0-9._-]{1,99}$/.test(value)) return applyCors(jsonError("Route Key مدل معتبر نیست.", 400), req.headers.get("origin"));
        data.routeKey = value || null;
      }
      let updatedProvider: { id: string; enabled: boolean; apiKeyEncrypted: string | null; authMode: string } | null = null;
      if (body.systemProviderId !== undefined) {
        const providerId = textValue(body.systemProviderId, 120);
        updatedProvider = providerId
          ? await db.systemProviderConfig.findUnique({ where: { id: providerId }, select: { id: true, enabled: true, apiKeyEncrypted: true, authMode: true } })
          : null;
        if (providerId && !updatedProvider) return applyCors(jsonError("Provider زیرساخت پیدا نشد.", 404), req.headers.get("origin"));
        data.systemProviderId = providerId || null;
      }
      if (body.displayName !== undefined) data.displayName = textValue(body.displayName, 180) || "Unnamed model";
      if (body.qualityTier !== undefined) data.qualityTier = textValue(body.qualityTier, 40) || "balanced";
      if (body.speedTier !== undefined) data.speedTier = textValue(body.speedTier, 40) || "balanced";
      for (const key of ["inputUsdPer1M","outputUsdPer1M"] as const) if (body[key] !== undefined) {
        const value = floatValue(body[key]);
        if (value == null) return applyCors(jsonError("نرخ مدل معتبر نیست.", 400), req.headers.get("origin"));
        data[key] = value;
      }
      if (body.contextWindow !== undefined) {
        const value = intValue(body.contextWindow, 0, 10_000_000);
        if (value == null) return applyCors(jsonError("contextWindow نامعتبر است.", 400), req.headers.get("origin"));
        data.contextWindow = value;
      }
      for (const key of ["vision","tools","structuredOutput","reasoning","commercialAvailable","active","trialEnabled"] as const) {
        if (typeof body[key] === "boolean") data[key] = body[key];
      }
      let model;
      if (body.trialDefault === true) {
        if (body.systemProviderId === undefined) {
          const current = await db.modelCatalog.findUnique({ where: { id }, include: { systemProvider: { select: { id: true, enabled: true, apiKeyEncrypted: true, authMode: true } } } });
          updatedProvider = current?.systemProvider ?? null;
        }
        if (!updatedProvider?.enabled || (!updatedProvider.apiKeyEncrypted && updatedProvider.authMode !== "none")) {
          return applyCors(jsonError("برای Trial Default ابتدا یک Provider فعال و پیکربندی‌شده انتخاب کن.", 400), req.headers.get("origin"));
        }
        model = await db.$transaction(async (tx) => {
          await tx.modelCatalog.updateMany({ where: { trialDefault: true, id: { not: id } }, data: { trialDefault: false } });
          return tx.modelCatalog.update({ where: { id }, data: { ...data, trialEnabled: true, trialDefault: true } });
        });
      } else {
        if (body.trialDefault === false) data.trialDefault = false;
        model = await db.modelCatalog.update({ where: { id }, data });
      }
      return applyCors(jsonOk({ admin, model }), req.headers.get("origin"));
    }

    if (action === "set_access" && id) {
      const planId = textValue(body.planId, 120);
      const modelCatalogId = textValue(body.modelCatalogId, 120);
      const enabled = typeof body.enabled === "boolean" ? body.enabled : null;
      const multiplier = body.creditMultiplierBps === undefined ? null : intValue(body.creditMultiplierBps, 1, 100000);
      if (!planId || !modelCatalogId || enabled == null || (body.creditMultiplierBps !== undefined && multiplier == null)) {
        return applyCors(jsonError("دسترسی مدل معتبر نیست.", 400), req.headers.get("origin"));
      }
      const access = await db.planModelAccess.upsert({
        where: { planId_modelCatalogId: { planId, modelCatalogId } },
        update: { enabled, creditMultiplierBps: multiplier ?? defaultCreditMultiplierBps("balanced") },
        create: { planId, modelCatalogId, enabled, creditMultiplierBps: multiplier ?? defaultCreditMultiplierBps("balanced") },
      });
      return applyCors(jsonOk({ admin, access }), req.headers.get("origin"));
    }

    if (action === "update_account" && id) {
      const account = await db.workspaceBillingAccount.findUnique({ where: { id } });
      if (!account) return applyCors(jsonError("حساب اعتباری پیدا نشد.", 404), req.headers.get("origin"));
      const data: Record<string, unknown> = {};
      if (typeof body.enforcementEnabled === "boolean") data.enforcementEnabled = body.enforcementEnabled;
      if (typeof body.status === "string" && ["active","past_due","suspended","canceled"].includes(body.status)) data.status = body.status;
      if (typeof body.planId === "string") {
        const plan = await db.plan.findUnique({ where: { id: body.planId } });
        if (!plan) return applyCors(jsonError("پلن پیدا نشد.", 404), req.headers.get("origin"));
        data.planId = plan.id;
      }
      if (Object.keys(data).length) {
        await db.$transaction(async (tx) => {
          const updated = await tx.workspaceBillingAccount.update({ where: { id }, data });
          if (data.planId) {
            await tx.subscription.updateMany({
              where: { billingAccountId: id, status: "active" },
              data: { planId: String(data.planId) },
            });
          }
          return updated;
        });
      }
      if (body.creditAdjustment !== undefined) {
        const amount = intValue(body.creditAdjustment, -10_000_000_000, 10_000_000_000);
        if (amount == null || amount === 0) return applyCors(jsonError("تغییر اعتبار نامعتبر است.", 400), req.headers.get("origin"));
        const result = await db.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${account.workspaceId}))`;
          const fresh = await tx.workspaceBillingAccount.findUniqueOrThrow({ where: { id } });
          const nextBalance = fresh.balanceCredits + amount;
          const idempotencyKey = "admin-credit:" + fresh.id + ":" + Date.now().toString(36) + ":" + Math.random().toString(36).slice(2, 10);
          await tx.workspaceBillingAccount.update({ where: { id }, data: { balanceCredits: nextBalance } });
          const ledger = await tx.creditLedgerEntry.create({
            data: {
              workspaceId: fresh.workspaceId, billingAccountId: id, amountCredits: amount, balanceAfter: nextBalance,
              entryType: amount > 0 ? "admin_grant" : "admin_adjustment",
              referenceType: "admin", description: amount > 0 ? "افزایش اعتبار توسط مدیر" : "اصلاح اعتبار توسط مدیر",
              idempotencyKey,
            },
          });
          return { balanceCredits: nextBalance, ledgerId: ledger.id };
        });
        return applyCors(jsonOk({ admin, account: result }), req.headers.get("origin"));
      }
      const updated = await db.workspaceBillingAccount.findUnique({
        where: { id },
        include: { plan: true, workspace: { select: { id:true, name:true } } },
      });
      return applyCors(jsonOk({ admin, account: updated }), req.headers.get("origin"));
    }

    return applyCors(jsonError("عملیات billing پشتیبانی نمی‌شود.", 400), req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}
