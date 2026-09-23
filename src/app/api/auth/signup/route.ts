import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import {
  hashPasswordWithDb,
  publicUser,
  sessionCookieHeader,
  signSessionToken,
} from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";

interface SignupBody {
  name?: unknown;
  email?: unknown;
  password?: unknown;
}

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    rateLimit(req, "signup", 10, 60_000);
    const body = await readJson<SignupBody>(req);

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return applyCors(jsonError("ایمیل واردشده معتبر نیست.", 400), req.headers.get("origin"));
    }
    if (password.length < 8 || password.length > 128) {
      return applyCors(
        jsonError("رمز عبور باید حداقل ۸ کاراکتر باشد.", 400),
        req.headers.get("origin")
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return applyCors(
        jsonError("حسابی با این ایمیل قبلاً ثبت شده است.", 409),
        req.headers.get("origin")
      );
    }

    const passwordHash = await hashPasswordWithDb(password);
    const { user, workspace } = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: name.length > 0 ? name : null,
          passwordHash,
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: "فضای کاری من",
          ownerId: user.id,
          members: { create: { userId: user.id, role: "owner" } },
        },
      });

      return { user, workspace };
    });

    const token = signSessionToken(user.id);
    const response = jsonOk(
      {
        user: publicUser(user),
        workspaces: [
          { id: workspace.id, name: workspace.name, role: "owner", createdAt: workspace.createdAt.toISOString() },
        ],
      },
      201
    );
    response.headers.set("Set-Cookie", sessionCookieHeader(token));
    return applyCors(response, req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e);
  }
}
