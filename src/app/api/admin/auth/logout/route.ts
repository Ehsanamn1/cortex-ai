import { NextResponse } from "next/server";
import { applyCors, jsonOk, toErrorResponse } from "@/lib/server/http";
import { clearAdminCookie } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const response = NextResponse.json({ ok: true });
    response.headers.set("Set-Cookie", clearAdminCookie());
    return applyCors(response, req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
