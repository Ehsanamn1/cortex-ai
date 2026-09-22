import { applyCors, jsonOk, toErrorResponse } from "@/lib/server/http";
import { clearSessionCookieHeader } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const response = jsonOk({ ok: true });
    response.headers.set("Set-Cookie", clearSessionCookieHeader());
    return applyCors(response, req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
