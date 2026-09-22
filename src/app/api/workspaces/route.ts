import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const workspaces = await db.workspace.findMany({
      where: { members: { some: { userId: session.user.id } } },
      include: { _count: { select: { agents: true } } },
      orderBy: { createdAt: "asc" },
    });
    const membershipByWorkspace = new Map(
      session.memberships.map((m) => [m.workspaceId, m])
    );
    return applyCors(
      jsonOk({
        workspaces: workspaces.map((w) => ({
          id: w.id,
          name: w.name,
          role: membershipByWorkspace.get(w.id)?.role ?? "member",
          createdAt: w.createdAt.toISOString(),
          _count: { agents: w._count.agents },
        })),
      }),
      req.headers.get("origin")
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(req);
    const body = await readJson<{ name?: unknown }>(req);
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    if (name.length < 2) {
      return applyCors(jsonError("نام فضای کاری باید حداقل ۲ کاراکتر باشد.", 400), req.headers.get("origin"));
    }
    const workspace = await db.workspace.create({
      data: {
        name,
        ownerId: session.user.id,
        members: { create: { userId: session.user.id, role: "owner" } },
      },
    });
    return applyCors(
      jsonOk(
        {
          workspace: {
            id: workspace.id,
            name: workspace.name,
            role: "owner",
            createdAt: workspace.createdAt.toISOString(),
          },
        },
        201
      ),
      req.headers.get("origin")
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
