import { NextResponse } from "next/server";
import { applyCors, toErrorResponse } from "@/lib/server/http";
import { createGoogleState, googleClientId, googleRedirectUri, googleStateCookie } from "@/lib/server/google-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const state = createGoogleState();
    const params = new URLSearchParams({
      client_id: googleClientId(),
      redirect_uri: googleRedirectUri(req),
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    const response = NextResponse.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString(), 302);
    response.headers.set("Set-Cookie", googleStateCookie(state));
    response.headers.set("Cache-Control", "no-store");
    return applyCors(response, req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}
