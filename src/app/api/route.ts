import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "Cortex AI",
    status: "ready",
    health: "/api/health",
  });
}
