import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Public liveness/readiness endpoint.
 * Detailed provider/configuration state is intentionally kept out of the
 * unauthenticated response to avoid leaking infrastructure metadata.
 */
export async function GET(req: Request) {
  try {
    rateLimit(req, "public-health", 30, 60_000);
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      database: "connected",
    }, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const requestId = globalThis.crypto?.randomUUID?.() ?? "health-error";
    console.error("[cortex][health]", JSON.stringify({
      requestId,
      error: e instanceof Error ? e.stack ?? e.message : String(e),
    }));
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        requestId,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
