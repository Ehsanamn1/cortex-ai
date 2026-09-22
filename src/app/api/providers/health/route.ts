import { applyCors, jsonError, jsonOk, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { llmManager } from "@/lib/providers/llm/manager";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

/** Live round-trip test of the active LLM provider (real completion). */
export async function POST(req: Request) {
  try {
    const session = await requireSession(req);
    void session;
    rateLimit(req, "provider-health", 6, 60_000);

    const workspaceId = new URL(req.url).searchParams.get("workspaceId") || session.memberships[0]?.workspaceId;
    const { provider } = await llmManager.resolveForWorkspace(workspaceId ?? undefined);
    if (!provider) {
      return applyCors(
        jsonError("سرویس‌دهنده هوش مصنوعی پیکربندی نشده است؛ تست اتصال ممکن نیست.", 503),
        req.headers.get("origin")
      );
    }
    const result = await provider.healthCheck();
    if (!result.ok) {
      return applyCors(jsonError(result.error, 502), req.headers.get("origin"));
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
      req.headers.get("origin")
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
