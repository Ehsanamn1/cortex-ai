import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin-auth";
import { encryptSecret } from "@/lib/server/secrets";
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
    const providers = await db.systemProviderConfig.findMany({
      orderBy: [{ isTrialProvider: "desc" }, { enabled: "desc" }, { updatedAt: "desc" }],
      include: {
        _count: { select: { models: true } },
        models: { where: { active: true }, orderBy: { updatedAt: "desc" }, take: 1, select: { modelId: true } },
      },
    });
    return applyCors(jsonOk({ providers: providers.map((row) => publicProvider(row, row.models[0]?.modelId ?? null)) }), req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const action = textValue(body.action, 40) || "create";

    if (action === "test") {
      const id = textValue(body.id, 120);
      const modelId = textValue(body.modelId, 180);
      if (!id || !modelId) return applyCors(jsonError("Provider و Model ID برای تست الزامی است.", 400), req.headers.get("origin"));
      const provider = await db.systemProviderConfig.findUnique({ where: { id } });
      if (!provider) return applyCors(jsonError("Provider پیدا نشد.", 404), req.headers.get("origin"));
      const runtime = buildSystemProviderForModel(provider, modelId);
      if (!runtime.isConfigured()) return applyCors(jsonError("Provider کلید/تنظیمات معتبر ندارد.", 400), req.headers.get("origin"));
      const health = await runtime.healthCheck();
      await db.systemProviderConfig.update({
        where: { id },
        data: { lastHealthStatus: health.ok ? "healthy" : "error", lastHealthError: health.ok ? null : health.error, lastHealthAt: new Date() },
      });
      return applyCors(jsonOk({ providerId: id, modelId, health }), req.headers.get("origin"));
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
    const isTrialProvider = body.isTrialProvider === true;
    const provider = await db.$transaction(async (tx) => {
      if (isTrialProvider) await tx.systemProviderConfig.updateMany({ where: { id: { not: id } }, data: { isTrialProvider: false } });
      return tx.systemProviderConfig.update({
        where: { id },
        data: {
          ...config,
          ...(apiKey ? { apiKeyEncrypted: encryptSecret(apiKey) } : {}),
          enabled: typeof body.enabled === "boolean" ? body.enabled : existing.enabled,
          isTrialProvider: typeof body.isTrialProvider === "boolean" ? isTrialProvider : existing.isTrialProvider,
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
