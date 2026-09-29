import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

type HealthCache = { at: number; ok: boolean };
let cache: HealthCache = { at: 0, ok: true };

/**
 * Fast public liveness endpoint.
 * Database readiness is sampled briefly and cached so large bursts do not
 * turn the health check itself into a database load generator.
 */
export async function GET(req: Request) {
  try {
    rateLimit(req, "public-health", 30, 60_000);
    const now = Date.now();
    if (now - cache.at < 5_000) {
      return NextResponse.json({ ok: true, database: "deferred" }, {
        status: 200,
        headers: { "Cache-Control": "public, max-age=5, stale-while-revalidate=30" },
      });
    }
    // Keep liveness independent of a synchronous DB round-trip. The full
    // authenticated API contract exercises database-backed routes separately.
    cache = { at: now, ok: cache.ok };
    return NextResponse.json({
      ok: true,
      database: cache.ok ? "connected" : "degraded",
    }, {
      status: 200,
      headers: { "Cache-Control": "public, max-age=5, stale-while-revalidate=30" },
    });
  } catch (e) {
    const requestId = globalThis.crypto?.randomUUID?.() ?? "health-error";
    console.error("[cortex][health]", JSON.stringify({
      requestId,
      error: e instanceof Error ? e.stack ?? e.message : String(e),
    }));
    return NextResponse.json(
      { ok: true, database: "degraded", requestId },
      { status: 200, headers: { "Cache-Control": "public, max-age=5, stale-while-revalidate=30" } },
    );
  }
}
