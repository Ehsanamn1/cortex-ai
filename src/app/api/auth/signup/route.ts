import { db } from "@/lib/db";
import { readJson } from "@/lib/server/http";
import { hashPasswordWithDb, publicUser, sessionCookieHeader, signSessionToken } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";

interface SignupBody { name?: unknown; email?: unknown; password?: unknown; }
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200, cookie?: string): Response {
  const res = new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
  }});
  if (cookie) res.headers.set("Set-Cookie", cookie);
  return res;
}

export async function POST(req: Request) {
  try {
    rateLimit(req, "signup", 10, 60_000);
    const body = await readJson<SignupBody>(req);
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return response({ error: "ایمیل واردشده معتبر نیست." }, 400);
    if (password.length < 8 || password.length > 128) return response({ error: "رمز عبور باید حداقل ۸ کاراکتر باشد." }, 400);

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return response({ error: "حسابی با این ایمیل قبلاً ثبت شده است." }, 409);

    const passwordHash = await hashPasswordWithDb(password);
    const { user, workspace } = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, name: name || null, passwordHash }});
      const workspace = await tx.workspace.create({
        data: { name: "فضای کاری من", ownerId: user.id, members: { create: { userId: user.id, role: "owner" }}}
      });
      return { user, workspace };
    });

    const token = signSessionToken(user.id);
    return response({
      user: publicUser(user),
      workspaces: [{ id: workspace.id, name: workspace.name, role: "owner", createdAt: workspace.createdAt.toISOString() }]
    }, 201, sessionCookieHeader(token));
  } catch (error) {
    const status = Number((error as { status?: unknown })?.status);
    if (Number.isInteger(status) && status > 0) return response({ error: error instanceof Error ? error.message : "درخواست ناموفق بود." }, status);
    const code = String((error as { code?: unknown })?.code ?? "");
    if (code === "P2002") return response({ error: "حسابی با این ایمیل قبلاً ثبت شده است." }, 409);
    console.error("[cortex][auth/signup] unhandled error:", error);
    return response({ error: "ثبت‌نام انجام نشد؛ لطفاً دوباره تلاش کنید." }, 503);
  }
}
