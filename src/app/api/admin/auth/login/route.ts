import { applyCors, jsonError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return applyCors(
    jsonError("ورود با نام کاربری و رمز عبور غیرفعال است؛ فقط از لینک خصوصی مالک سیستم استفاده کنید.", 410),
    req.headers.get("origin"),
  );
}
