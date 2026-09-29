import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

let dbProbeCache: { at: number; ok: boolean } | null = null;
let dbProbePromise: Promise<boolean> | null = null;
const DB_PROBE_CACHE_MS = 5_000;

async function probeDatabase(): Promise<boolean> {
  const now = Date.now();
  if (dbProbeCache && now - dbProbeCache.at < DB_PROBE_CACHE_MS) return dbProbeCache.ok;
  if (dbProbePromise) return dbProbePromise;
  dbProbePromise = db.$queryRaw`SELECT 1`
    .then(() => {
      dbProbeCache = { at: Date.now(), ok: true };
      return true;
    })
    .catch((error) => {
      dbProbeCache = { at: Date.now(), ok: false };
      console.error("[cortex][health][db-probe]", error instanceof Error ? error.message : String(error));
      return false;
    })
    .finally(() => {
      dbProbePromise = null;
    });
  return dbProbePromise;
}

/**
 * Public liveness/readiness endpoint.
 * Detailed provider/configuration state is intentionally kept out of the
 * unauthenticated response to avoid leaking infrastructure metadata.
 */
export async function GET(req: Request) {
  try {
    rateLimit(req, "public-health", 30, 60_000);
    const databaseOk = await probeDatabase();
    return NextResponse.json({
      ok: true,
      liveness: "up",
      database: databaseOk ? "connected" : "degraded",
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
        ok: true,
        liveness: "up",
        database: "degraded",
        requestId,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
