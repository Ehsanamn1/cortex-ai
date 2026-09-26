import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { assertWorkspaceAccess, requireSession } from "@/lib/server/auth";
import { loadAgentForSession } from "@/lib/server/access";
import { encryptSecret } from "@/lib/server/secrets";
import { rateLimit } from "@/lib/server/rate-limit";
import { llmManager } from "@/lib/providers/llm/manager";
import { validateProviderBaseUrl } from "@/lib/providers/llm/provider-url";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function serializeConfig(config: {
  id: string;
  providerName: string;
  baseUrl: string;
  model: string;
  authMode: string;
  enabled: boolean;
  apiKeyEncrypted: string | null;
}) {
  return {
    id: config.id,
    providerName: config.providerName,
    baseUrl: config.baseUrl,
    model: config.model,
    authMode: config.authMode,
    enabled: config.enabled,
    hasApiKey: Boolean(config.apiKeyEncrypted),
  };
}

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);
    const config = await db.agentProviderConfig.findUnique({ where: { agentId: agent.id } });
    const status = await llmManager.statusForAgent(agent.id, agent.workspaceId);

    return applyCors(
      jsonOk({
        config: config ? serializeConfig(config) : null,
        status,
      }),
      req.headers.get("origin"),
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);
    const membership = assertWorkspaceAccess(session, agent.workspaceId);

    if (!["owner", "admin"].includes(membership.role)) {
      return applyCors(
        jsonError("فقط مالک یا مدیر می‌تواند اتصال هوش مصنوعی این ایجنت را تغییر دهد.", 403),
        req.headers.get("origin"),
      );
    }

    const body = await readJson<Record<string, unknown>>(req);
    const providerName = typeof body.providerName === "string"
      ? body.providerName.trim().slice(0, 80)
      : "";
    const baseUrl = typeof body.baseUrl === "string"
      ? body.baseUrl.trim().replace(/\/$/, "")
      : "";
    const model = typeof body.model === "string"
      ? body.model.trim().slice(0, 160)
      : "";
    const authMode =
      typeof body.authMode === "string" && ["bearer", "x-api-key", "none"].includes(body.authMode)
        ? body.authMode
        : "bearer";
    const enabled = body.enabled !== false;
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (providerName.length < 2 || baseUrl.length < 8 || !model) {
      return applyCors(
        jsonError("نام سرویس، Base URL و Model الزامی هستند.", 400),
        req.headers.get("origin"),
      );
    }

    try {
      validateProviderBaseUrl(baseUrl);
    } catch {
      return applyCors(
        jsonError("Base URL باید یک آدرس عمومی http/https باشد و نباید به localhost یا شبکه خصوصی اشاره کند.", 400),
        req.headers.get("origin"),
      );
    }

    const current = await db.agentProviderConfig.findUnique({ where: { agentId: agent.id } });

    if (authMode !== "none" && !apiKey && !current?.apiKeyEncrypted) {
      return applyCors(
        jsonError("برای این اتصال، API Key الزامی است.", 400),
        req.headers.get("origin"),
      );
    }

    const config = await db.agentProviderConfig.upsert({
      where: { agentId: agent.id },
      update: {
        workspaceId: agent.workspaceId,
        providerName,
        baseUrl,
        model,
        authMode,
        enabled,
        ...(apiKey ? { apiKeyEncrypted: encryptSecret(apiKey) } : {}),
      },
      create: {
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        providerName,
        baseUrl,
        model,
        authMode,
        enabled,
        apiKeyEncrypted: apiKey ? encryptSecret(apiKey) : null,
      },
    });

    await db.auditLog.create({
      data: {
        workspaceId: agent.workspaceId,
        userId: session.user.id,
        action: "agent_provider.updated",
        entityType: "agent_provider_config",
        entityId: config.id,
        metadata: JSON.stringify({
          agentId: agent.id,
          providerName,
          baseUrl,
          model,
          authMode,
          enabled,
          rotatedKey: Boolean(apiKey),
          hadPreviousConfig: Boolean(current),
        }),
      },
    });

    return applyCors(
      jsonOk({
        config: serializeConfig(config),
        status: await llmManager.statusForAgent(agent.id, agent.workspaceId),
      }),
      req.headers.get("origin"),
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);
    rateLimit(req, "agent-provider-health-" + agent.id, 6, 60_000);

    const config = await db.agentProviderConfig.findUnique({ where: { agentId: agent.id } });
    if (!config?.enabled) {
      return applyCors(
        jsonError("ابتدا اتصال هوش مصنوعی همین ایجنت را ذخیره و فعال کنید.", 503),
        req.headers.get("origin"),
      );
    }

    const { provider } = await llmManager.resolveForAgent(agent.id, agent.workspaceId);
    if (!provider) {
      return applyCors(
        jsonError("اتصال هوش مصنوعی این ایجنت معتبر نیست؛ API Key، Base URL و Model ID را بررسی کنید.", 503),
        req.headers.get("origin"),
      );
    }

    const result = await provider.healthCheck();
    if (!result.ok) {
      return applyCors(
        jsonError(result.error, 502),
        req.headers.get("origin"),
      );
    }

    return applyCors(
      jsonOk({
        ok: true,
        llm: {
          provider: provider.name,
          model: provider.model() ?? "—",
          latencyMs: result.latencyMs,
          sample: result.sample,
        },
      }),
      req.headers.get("origin"),
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
