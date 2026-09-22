import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  publicUser,
  sessionCookieHeader,
  signSessionToken,
} from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const DEMO_EMAIL = "demo@cortex.local";
const DEMO_NAME = "Cortex Demo";

export async function POST() {
  try {
    let user = await db.user.findUnique({ where: { email: DEMO_EMAIL } });

    if (!user) {
      user = await db.user.create({
        data: {
          email: DEMO_EMAIL,
          name: DEMO_NAME,
          passwordHash: hashPassword("cortex-demo"),
        },
      });
    }

    let workspace = await db.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!workspace) {
      workspace = await db.workspace.create({
        data: {
          name: "فضای کاری Demo",
          ownerId: user.id,
          members: { create: { userId: user.id, role: "owner" } },
        },
      });
    } else {
      const membership = await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: user.id,
          },
        },
      });
      if (!membership) {
        await db.workspaceMember.create({
          data: { workspaceId: workspace.id, userId: user.id, role: "owner" },
        });
      }
    }

    const token = signSessionToken(user.id);
    const response = NextResponse.json({
      user: publicUser(user),
      workspaces: [{ id: workspace.id, name: workspace.name, role: "owner", createdAt: workspace.createdAt.toISOString() }],
      demo: true,
    });
    response.headers.set("Set-Cookie", sessionCookieHeader(token));
    return response;
  } catch (e) {
    console.error("[cortex] demo session bootstrap failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "راه‌اندازی حساب Demo ناموفق بود." },
      { status: 500 }
    );
  }
}
