import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getSession,
  hashPassword,
  publicUser,
  sessionCookieHeader,
  signSessionToken,
} from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * Direct-access bootstrap used by the current no-login UI.
 * Existing authenticated sessions are preserved; a new browser gets an isolated
 * guest account and workspace instead of sharing a global demo account.
 */
export async function POST(req: Request) {
  try {
    const existing = await getSession(req);
    if (existing) {
      return NextResponse.json({
        user: publicUser(existing.user),
        workspaces: existing.memberships.map((membership) => ({
          id: membership.workspace.id,
          name: membership.workspace.name,
          role: membership.role,
          createdAt: membership.createdAt.toISOString(),
        })),
      });
    }

    const guestId = crypto.randomUUID();
    const user = await db.user.create({
      data: {
        email: `guest-${guestId}@cortex.local`,
        name: "کاربر Cortex",
        passwordHash: hashPassword(crypto.randomBytes(32).toString("hex")),
      },
    });

    const workspace = await db.workspace.create({
      data: {
        name: "فضای کاری من",
        ownerId: user.id,
        members: { create: { userId: user.id, role: "owner" } },
      },
    });

    const token = signSessionToken(user.id);
    const response = NextResponse.json({
      user: publicUser(user),
      workspaces: [{
        id: workspace.id,
        name: workspace.name,
        role: "owner",
        createdAt: workspace.createdAt.toISOString(),
      }],
      guest: true,
    });
    response.headers.set("Set-Cookie", sessionCookieHeader(token));
    return response;
  } catch (error) {
    console.error("[cortex] session bootstrap failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "راه‌اندازی Cortex ناموفق بود." },
      { status: 500 }
    );
  }
}
