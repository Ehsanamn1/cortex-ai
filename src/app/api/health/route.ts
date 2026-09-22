import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/server/rate-limit";
import { getKnowledgeBucket } from "@/lib/cloudflare-storage";
import { llmManager } from "@/lib/providers/llm/manager";
import { embeddingManager } from "@/lib/providers/embeddings/manager";

export const dynamic = "force-dynamic";

function safeError(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  return message
    .replace(/postgresql:\/\/[^\s]+/gi, "postgresql://[redacted]")
    .replace(/password=[^\s&]+/gi, "password=[redacted]")
    .slice(0, 800);
}

export async function GET(req: Request) {
  try {
    rateLimit(req, "public-health", 30, 60_000);
    const [databaseCheck, knowledgeBucket] = await Promise.all([
      db.$queryRaw`SELECT 1`,
      getKnowledgeBucket(),
    ]);
    const llm = llmManager.status();
    const embeddings = embeddingManager.status();

    return NextResponse.json({
      ok: true,
      database: databaseCheck ? "connected" : "error",
      storage: knowledgeBucket ? "r2" : "missing",
      llm: {
        provider: llm.provider,
        status: llm.status,
        model: llm.model,
      },
      embeddings: {
        provider: embeddings.provider,
        status: embeddings.status,
        model: embeddings.model,
        mode: embeddings.mode,
      },
      env: {
        DATABASE_URL: process.env.DATABASE_URL ? "set" : "missing",
        APP_SECRET_KEY: process.env.APP_SECRET_KEY ? "set" : "missing",
        CORTEX_ADMIN_PASSWORD: process.env.CORTEX_ADMIN_PASSWORD ? "set" : "missing",
        NODE_ENV: process.env.NODE_ENV ?? null,
      },
    });
  } catch (e) {
    console.error("[cortex/health] dependency check failed", e);
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        error: safeError(e),
        env: {
          DATABASE_URL: process.env.DATABASE_URL ? "set" : "missing",
          APP_SECRET_KEY: process.env.APP_SECRET_KEY ? "set" : "missing",
          CORTEX_ADMIN_PASSWORD: process.env.CORTEX_ADMIN_PASSWORD ? "set" : "missing",
          NODE_ENV: process.env.NODE_ENV ?? null,
        },
      },
      { status: 500 }
    );
  }
}
