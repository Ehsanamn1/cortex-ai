import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin-auth";
import { decryptSecret, encryptSecret } from "@/lib/server/secrets";
import { buildSystemProviderForModel } from "@/lib/server/system-provider";
import { validateProviderBaseUrl } from "@/lib/providers/llm/provider-url";

export const dynamic = "force-dynamic";

function textValue(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
const PROTOCOLS = new Set(["openai-compatible", "openrouter", "anthropic", "gemini"]);
const AUTH_MODES = new Set(["bearer", "x-api-key", "none"]);

function validateConfig(body: Record<string, unknown>) {
  const displayName = textValue(body.displayName, 120);
  const key = textValue(body.key, 80).toLowerCase();
  const providerName = textValue(body.providerName, 80);
  const protocol = textValue(body.protocol, 40).toLowerCase() || "openai-compatible";
  const authMode = textValue(body.authMode, 40).toLowerCase() || "bearer";
  const baseUrl = textValue(body.baseUrl, 500).replace(/\/$/, "");
  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/.test(key)) throw Object.assign(new Error("کلید Provider معتبر نیست."), { status: 400 });
  if (!displayName || !providerName || !baseUrl || !PROTOCOLS.has(protocol) || !AUTH_MODES.has(authMode)) {
    throw Object.assign(new Error("اطلاعات Provider کامل یا معتبر نیست."), { status: 400 });
  }
  validateProviderBaseUrl(baseUrl);
  if (protocol === "openrouter" && !/^https:\/\//i.test(baseUrl)) {
    throw Object.assign(new Error("Base URL برای OpenRouter باید HTTPS باشد."), { status: 400 });
  }
  return { key, displayName, providerName, protocol, authMode, baseUrl };
}

function publicProvider(row: any, testModelId: string | null = null) {
  return {
    id: row.id,
    key: row.key,
    displayName: row.displayName,
    providerName: row.providerName,
    protocol: row.protocol,
    authMode: row.authMode,
    baseUrl: row.baseUrl,
    enabled: row.enabled,
    isTrialProvider: row.isTrialProvider,
    configured: Boolean(row.apiKeyEncrypted) || row.authMode === "none",
    lastHealthStatus: row.lastHealthStatus,
    lastHealthError: row.lastHealthError,
    lastHealthAt: row.lastHealthAt,
    modelsCount: row._count?.models ?? 0,
    testModelId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const [providers, trialProvider, trialModel, freePlan] = await Promise.all([
      db.systemProviderConfig.findMany({
        orderBy: [{ isTrialProvider: "desc" }, { enabled: "desc" }, { updatedAt: "desc" }],
        include: {
          _count: { select: { models: true } },
          models: { where: { active: true }, orderBy: { updatedAt: "desc" }, take: 1, select: { modelId: true } },
        },
      }),
      db.systemProviderConfig.findFirst({ where: { isTrialProvider: true } }),
      db.modelCatalog.findFirst({
        where: { active: true, trialDefault: true },
        include: { systemProvider: true },
      }),
      db.plan.findUnique({ where: { key: "free" }, select: { id: true, name: true, monthlyCredits: true } }),
    ]);
    return applyCors(jsonOk({
      providers: providers.map((row) => publicProvider(row, row.models[0]?.modelId ?? null)),
      trial: {
        provider: trialProvider ? publicProvider(trialProvider) : null,
        model: trialModel ? {
          id: trialModel.id,
          routeKey: trialModel.routeKey,
          displayName: trialModel.displayName,
          provider: trialModel.provider,
          modelId: trialModel.modelId,
          active: trialModel.active,
          trialEnabled: trialModel.trialEnabled,
          trialDefault: trialModel.trialDefault,
          systemProviderId: trialModel.systemProviderId,
          systemProviderName: trialModel.systemProvider?.displayName ?? null,
        } : null,
        credits: freePlan?.monthlyCredits ?? 0,
        planName: freePlan?.name ?? "آزمایشی",
        ready: Boolean(trialModel?.active && trialModel?.trialEnabled && trialModel?.systemProvider?.enabled &&
          (trialModel.systemProvider.authMode === "none" || trialModel.systemProvider.apiKeyEncrypted)),
      },
    }), req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const action = textValue(body.action, 40) || "create";

    if (action === "configure_trial") {
      const providerId = textValue(body.providerId ?? body.id, 120);
      const modelCatalogId = textValue(body.modelCatalogId, 120);
      if (!providerId || !modelCatalogId) {
        return applyCors(jsonError("Provider و مدل Trial را هر دو انتخاب کن.", 400), req.headers.get("origin"));
      }

      const [provider, model] = await Promise.all([
        db.systemProviderConfig.findUnique({ where: { id: providerId } }),
        db.modelCatalog.findUnique({ where: { id: modelCatalogId } }),
      ]);
      if (!provider) return applyCors(jsonError("Provider انتخاب‌شده پیدا نشد.", 404), req.headers.get("origin"));
      if (!model) return applyCors(jsonError("مدل انتخاب‌شده پیدا نشد.", 404), req.headers.get("origin"));

      const configured = Boolean(provider.apiKeyEncrypted) || provider.authMode === "none";
      if (!provider.enabled || !configured) {
        return applyCors(jsonError("Provider انتخاب‌شده هنوز آماده استفاده نیست. ابتدا آن را فعال و API Key/Base URL را بررسی کن.", 400), req.headers.get("origin"));
      }
      if (!model.active) return applyCors(jsonError("مدل انتخاب‌شده فعال نیست.", 400), req.headers.get("origin"));

      const runtime = buildSystemProviderForModel(provider, model.modelId);
      if (!runtime.isConfigured()) {
        return applyCors(jsonError("Provider انتخاب‌شده با تنظیمات فعلی قابل اجرا نیست.", 400), req.headers.get("origin"));
      }

      const health = await runtime.healthCheck();
      await db.systemProviderConfig.update({
        where: { id: providerId },
        data: {
          lastHealthStatus: health.ok ? "healthy" : "error",
          lastHealthError: health.ok ? null : health.error,
          lastHealthAt: new Date(),
        },
      });
      if (!health.ok) {
        return applyCors(jsonOk({
          ready: false,
          configured: true,
          provider: publicProvider(provider),
          model: { id: model.id, displayName: model.displayName, modelId: model.modelId },
          health,
        }), req.headers.get("origin"));
      }

      const result = await db.$transaction(async (tx) => {
        await tx.systemProviderConfig.updateMany({
          where: { id: { not: providerId } },
          data: { isTrialProvider: false },
        });
        await tx.systemProviderConfig.update({
          where: { id: providerId },
          data: { isTrialProvider: true },
        });
        await tx.modelCatalog.updateMany({
          where: { trialDefault: true, id: { not: modelCatalogId } },
          data: { trialDefault: false },
        });
        const trialModel = await tx.modelCatalog.update({
          where: { id: modelCatalogId },
          data: {
            systemProviderId: providerId,
            trialEnabled: true,
            trialDefault: true,
            active: true,
          },
        });
        const free = await tx.plan.findUnique({ where: { key: "free" }, select: { id: true } });
        if (free) {
          await tx.planModelAccess.upsert({
            where: { planId_modelCatalogId: { planId: free.id, modelCatalogId } },
            update: { enabled: true, creditMultiplierBps: 200 },
            create: { planId: free.id, modelCatalogId, enabled: true, creditMultiplierBps: 100 },
          });
        }
        return trialModel;
      });

      return applyCors(jsonOk({
        ready: true,
        configured: true,
        provider: publicProvider({ ...provider, isTrialProvider: true }),
        model: {
          id: result.id,
          routeKey: result.routeKey,
          displayName: result.displayName,
          modelId: result.modelId,
          systemProviderId: result.systemProviderId,
          trialEnabled: result.trialEnabled,
          trialDefault: result.trialDefault,
        },
        health,
      }), req.headers.get("origin"));
    }

    if (action === "test") {
      const providerId = textValue(body.providerId, 120);
      const modelId = textValue(body.modelId, 180);
      if (!providerId) return applyCors(jsonError("شناسه Provider الزامی است.", 400), req.headers.get("origin"));
      const provider = await db.systemProviderConfig.findUnique({ where: { id: providerId } });
      if (!provider) return applyCors(jsonError("Provider پیدا نشد.", 404), req.headers.get("origin"));
      const selectedModel = modelId || (await db.modelCatalog.findFirst({ where: { systemProviderId: providerId, active: true }, orderBy: { updatedAt: "desc" }, select: { modelId: true } }))?.modelId;
      if (!selectedModel) return applyCors(jsonError("برای تست، حداقل یک Model ID وارد کن.", 400), req.headers.get("origin"));
      const runtime = buildSystemProviderForModel(provider, selectedModel);
      if (!runtime.isConfigured()) return applyCors(jsonError("Provider هنوز API Key یا تنظیمات احراز هویت لازم را ندارد.", 400), req.headers.get("origin"));
      const health = await runtime.healthCheck();
      await db.systemProviderConfig.update({ where: { id: providerId }, data: { lastHealthStatus: health.ok ? "healthy" : "error", lastHealthError: health.ok ? null : health.error, lastHealthAt: new Date() } });
      return applyCors(jsonOk({ provider: publicProvider(provider, selectedModel), modelId: selectedModel, health }), req.headers.get("origin"));
    }

    if (action === "discover_models") {
      const providerId = textValue(body.providerId, 120);
      if (!providerId) return applyCors(jsonError("شناسه Provider الزامی است.", 400), req.headers.get("origin"));
      const provider = await db.systemProviderConfig.findUnique({ where: { id: providerId } });
      if (!provider) return applyCors(jsonError("Provider پیدا نشد.", 404), req.headers.get("origin"));
      if (provider.protocol !== "openai-compatible" && provider.protocol !== "openrouter") {
        return applyCors(jsonOk({ supported: false, models: [], note: "کشف خودکار مدل برای این Protocol فعال نیست؛ Model ID را دستی وارد کن." }), req.headers.get("origin"));
      }
      const headers: Record<string, string> = { accept: "application/json" };
      const apiKey = provider.apiKeyEncrypted ? decryptSecret(provider.apiKeyEncrypted) : "";
      if (apiKey && provider.authMode === "bearer") headers.authorization = "Bearer " + apiKey;
      if (apiKey && provider.authMode === "x-api-key") headers["x-api-key"] = apiKey;
      const base = await (async () => {
        const url = validateProviderBaseUrl(provider.baseUrl);
        if (process.env.APP_ENV === "production" || process.env.NODE_ENV === "production") {
          const host = url.hostname.toLowerCase().replace(/\.$/, "");
          if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) && !host.includes(":")) {
            // The runtime generation path performs the stricter public-resolution check.
            // Model discovery is read-only but must still reject malformed/private base URLs.
          }
        }
        return url;
      })();
      const endpoint = base.toString().replace(/\/$/, "") + "/models";
      const started = Date.now();
      let response: Response;
      try {
        response = await fetch(endpoint, { headers, cache: "no-store", signal: AbortSignal.timeout(20_000) });
      } catch {
        return applyCors(jsonError("ارتباط با endpoint مدل‌های Provider برقرار نشد.", 502), req.headers.get("origin"));
      }
      if (!response.ok) return applyCors(jsonError("کشف مدل‌ها از Provider با HTTP " + response.status + " متوقف شد.", 502), req.headers.get("origin"));
      const payload = await response.json() as { data?: Array<{ id?: string; name?: string }> };
      const models = (payload.data ?? []).map((item) => String(item.id || item.name || "").trim()).filter(Boolean).slice(0, 500);
      return applyCors(jsonOk({ supported: true, models, endpoint, latencyMs: Date.now() - started }), req.headers.get("origin"));
    }

    if (action === "create") {
      const config = validateConfig(body);
      const apiKey = textValue(body.apiKey, 4000);
      if (config.authMode !== "none" && !apiKey) return applyCors(jsonError("برای Provider احراز هویت‌شده API Key لازم است.", 400), req.headers.get("origin"));
      const isTrialProvider = body.isTrialProvider === true;
      const provider = await db.$transaction(async (tx) => {
        if (isTrialProvider) await tx.systemProviderConfig.updateMany({ data: { isTrialProvider: false } });
        return tx.systemProviderConfig.create({
          data: {
            ...config,
            apiKeyEncrypted: apiKey ? encryptSecret(apiKey) : null,
            enabled: body.enabled !== false,
            isTrialProvider,
          },
        });
      });
      return applyCors(jsonOk({ provider: publicProvider(provider) }, 201), req.headers.get("origin"));
    }

    return applyCors(jsonError("عملیات Provider پشتیبانی نمی‌شود.", 400), req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: Request) {
  try {
    requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const id = textValue(body.id, 120);
    if (!id) return applyCors(jsonError("شناسه Provider الزامی است.", 400), req.headers.get("origin"));
    const existing = await db.systemProviderConfig.findUnique({ where: { id } });
    if (!existing) return applyCors(jsonError("Provider پیدا نشد.", 404), req.headers.get("origin"));
    const merged = { ...existing, ...body, displayName: body.displayName ?? existing.displayName, key: body.key ?? existing.key, providerName: body.providerName ?? existing.providerName, protocol: body.protocol ?? existing.protocol, authMode: body.authMode ?? existing.authMode, baseUrl: body.baseUrl ?? existing.baseUrl };
    const config = validateConfig(merged);
    const apiKey = textValue(body.apiKey, 4000);
    if (config.authMode !== "none" && !apiKey && !existing.apiKeyEncrypted) return applyCors(jsonError("برای Provider احراز هویت‌شده API Key لازم است.", 400), req.headers.get("origin"));
    const requestedTrialProvider = body.isTrialProvider === true;
    const requestedEnabled = typeof body.enabled === "boolean" ? body.enabled : existing.enabled;
    const isTrialProvider = requestedEnabled ? requestedTrialProvider : false;
    const provider = await db.$transaction(async (tx) => {
      if (isTrialProvider) await tx.systemProviderConfig.updateMany({ where: { id: { not: id } }, data: { isTrialProvider: false } });
      return tx.systemProviderConfig.update({
        where: { id },
        data: {
          ...config,
          ...(apiKey ? { apiKeyEncrypted: encryptSecret(apiKey) } : (config.authMode === "none" ? { apiKeyEncrypted: null } : {})),
          enabled: requestedEnabled,
          isTrialProvider: typeof body.isTrialProvider === "boolean" ? isTrialProvider : (requestedEnabled ? existing.isTrialProvider : false),
          lastHealthStatus: "unknown",
          lastHealthError: null,
          lastHealthAt: null,
        },
        include: { _count: { select: { models: true } } },
      });
    });
    return applyCors(jsonOk({ provider: publicProvider(provider) }), req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(req: Request) {
  try {
    requireAdmin(req);
    const id = new URL(req.url).searchParams.get("id")?.trim() || "";
    if (!id) return applyCors(jsonError("شناسه Provider الزامی است.", 400), req.headers.get("origin"));
    const provider = await db.systemProviderConfig.findUnique({ where: { id }, include: { _count: { select: { models: true } } } });
    if (!provider) return applyCors(jsonError("Provider پیدا نشد.", 404), req.headers.get("origin"));
    if ((provider._count.models ?? 0) > 0) return applyCors(jsonError("ابتدا اتصال مدل‌ها را به Provider دیگری منتقل کنید.", 409), req.headers.get("origin"));
    await db.systemProviderConfig.delete({ where: { id } });
    return applyCors(jsonOk({ ok: true }), req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}
