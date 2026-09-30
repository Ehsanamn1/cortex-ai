import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyCors, toErrorResponse } from "@/lib/server/http";
import { clearGoogleStateCookie, googleClientId, googleClientSecret, googleRedirectUri, readGoogleState, verifyGoogleState } from "@/lib/server/google-auth";
import { randomBytes } from "@/lib/server/random";
import { sessionCookieHeader, signSessionToken } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

type GoogleUser = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

function safePasswordMarker() {
  return "google-only:" + Buffer.from(randomBytes(32)).toString("hex");
}

function looksEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !verifyGoogleState(state) || readGoogleState(req) !== state) {
      return NextResponse.redirect(new URL("/login?oauth=google_error", req.url), 303);
    }

    const body = new URLSearchParams({
      code,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      redirect_uri: googleRedirectUri(req),
      grant_type: "authorization_code",
    });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!tokenResponse.ok) throw Object.assign(new Error("تأیید ورود Google ناموفق بود."), { status: 401 });
    const tokenBody = await tokenResponse.json() as { access_token?: string };
    if (!tokenBody.access_token) throw Object.assign(new Error("توکن Google دریافت نشد."), { status: 401 });

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: "Bearer " + tokenBody.access_token },
    });
    if (!profileResponse.ok) throw Object.assign(new Error("دریافت حساب Google ناموفق بود."), { status: 401 });
    const profile = await profileResponse.json() as GoogleUser;
    const email = profile.email?.trim().toLowerCase() || "";
    if (!profile.sub || !looksEmail(email) || profile.email_verified !== true) {
      throw Object.assign(new Error("حساب Google تأییدشده نیست."), { status: 401 });
    }

    let user = await db.user.findUnique({ where: { googleSub: profile.sub } });
    if (!user) {
      const byEmail = await db.user.findUnique({ where: { email } });
      user = byEmail
        ? await db.user.update({
            where: { id: byEmail.id },
            data: { googleSub: profile.sub, avatarUrl: profile.picture ?? byEmail.avatarUrl, name: profile.name ?? byEmail.name },
          })
        : await db.user.create({
            data: {
              email,
              name: profile.name || email.split("@")[0],
              passwordHash: safePasswordMarker(),
              googleSub: profile.sub,
              avatarUrl: profile.picture ?? null,
            },
          });
    } else {
      user = await db.user.update({
        where: { id: user.id },
        data: { name: profile.name ?? user.name, avatarUrl: profile.picture ?? user.avatarUrl },
      });
    }

    const session = signSessionToken(user.id);
    const response = NextResponse.redirect(new URL("/app", req.url), 303);
    response.headers.set("Set-Cookie", sessionCookieHeader(session));
    response.headers.append("Set-Cookie", clearGoogleStateCookie());
    response.headers.set("Cache-Control", "no-store");
    return applyCors(response, req.headers.get("origin"));
  } catch (error) {
    return NextResponse.redirect(new URL("/login?oauth=google_error", req.url), 303);
  }
}
