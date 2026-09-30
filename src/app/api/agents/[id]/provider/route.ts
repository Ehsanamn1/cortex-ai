import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { loadAgentForSession } from "@/lib/server/access";
import { rateLimit } from "@/lib/server/rate-limit";
import { llmManager } from "@/lib/providers/llm/manager";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function serializeConfig(config: {
  id: string;
  providerName: string;
  baseUrl: string;
  model: string;
  protocol: string;
  authMode: string;
  enabled: boolean;
  apiKeyEncrypted: string | null;
}) {
  return {
    id: config.id,
    providerName: config.providerName,
    baseUrl: config.baseUrl,
    model: config.model,
    protocol: config.protocol || "openai-compatible",
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
    const status = await llmManager.statusForAgent(agent.id);
    return applyCors(jsonOk({
      config: null,
      status,
      managed: true,
      message: "اتصال Provider توسط پیشخوان Cortex مدیریت می‌شود.",
    }), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PUT(req: Request) {
  return applyCors(
    jsonError("تنظیم مستقیم Provider برای حساب مشتری غیرفعال است؛ Provider و کلیدها فقط از پیشخوان مدیر سیستم مدیریت می‌شوند.", 410),
    req.headers.get("origin"),
  );
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession(req);
    const { id } = await params;
    const agent = await loadAgentForSession(session, id);
    rateLimit(req, "agent-provider-health-" + agent.id, 6, 60_000);

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

