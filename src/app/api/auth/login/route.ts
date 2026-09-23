import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import {
  hashPasswordWithDb,
  publicUser,
  sessionCookieHeader,
  signSessionToken,
  verifyPassword,
} from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

export async function POST(req: Request) {
  try {
    rateLimit(req, "login", 12, 60_000);
    const body = await readJson<LoginBody>(req);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return applyCors(jsonError("ایمیل و رمز عبور الزامی است.", 400), req.headers.get("origin"));
    }

    const user = await db.user.findUnique({
      where: { email },
      include: { memberships: { include: { workspace: { select: { id: true, name: true } } } } },
    });
    // Constant-ish flow: same error regardless of which factor failed.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return applyCors(jsonError("ایمیل یا رمز عبور نادرست است.", 401), req.headers.get("origin"));
    }

    if (user.passwordHash.startsWith("scrypt:")) {
      void hashPassword(password).then((migratedHash) =>
        db.user.update({ where: { id: user.id }, data: { passwordHash: migratedHash } }).catch(() => undefined),
      );
    }

    const token = signSessionToken(user.id);
    const response = jsonOk({
      user: publicUser(user),
      workspaces: user.memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
      })),
    });
    response.headers.set("Set-Cookie", sessionCookieHeader(token));
    return applyCors(response, req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
