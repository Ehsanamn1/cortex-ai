import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function safeError(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  return message
    .replace(/postgresql:\/\/[^\s]+/gi, "postgresql://[redacted]")
    .replace(/password=[^\s&]+/gi, "password=[redacted]")
    .slice(0, 800);
}

export async function GET() {
  try {
    const userCount = await db.user.count();
    const workspaceCount = await db.workspace.count();
    return NextResponse.json({
      ok: true,
      database: "connected",
      userCount,
      workspaceCount,
      env: {
        DATABASE_URL: process.env.DATABASE_URL ? "set" : "missing",
        APP_SECRET_KEY: process.env.APP_SECRET_KEY ? "set" : "missing",
        NODE_ENV: process.env.NODE_ENV ?? null,
      },
    });
  } catch (e) {
    console.error("[cortex/health] database check failed", e);
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        error: safeError(e),
        env: {
          DATABASE_URL: process.env.DATABASE_URL ? "set" : "missing",
          APP_SECRET_KEY: process.env.APP_SECRET_KEY ? "set" : "missing",
          NODE_ENV: process.env.NODE_ENV ?? null,
        },
      },
      { status: 500 }
    );
  }
}
