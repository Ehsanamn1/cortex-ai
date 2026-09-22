import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const plugins = await db.plugin.findMany({ orderBy: { createdAt: "desc" } });
    return applyCors(jsonOk({ plugins }), req.headers.get("origin"));
  } catch (e) { return toErrorResponse(e); }
}

export async function POST(req: Request) {
  try {
    requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const key = typeof body.key === "string" ? body.key.trim().toLowerCase().slice(0, 120) : "";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
    const version = typeof body.version === "string" ? body.version.trim().slice(0, 40) : "1.0.0";
    const manifest = typeof body.manifest === "string" ? body.manifest.slice(0, 20000) : "";
    if (!/^[a-z0-9][a-z0-9._-]{1,119}$/.test(key) || name.length < 2) {
      return applyCors(jsonError("شناسه افزونه و نام آن معتبر نیست.", 400), req.headers.get("origin"));
    }
    const plugin = await db.plugin.create({ data: { key, name, description: description || null, version, manifest: manifest || null, enabled: true } });
    return applyCors(jsonOk({ plugin }, 201), req.headers.get("origin"));
  } catch (e) { return toErrorResponse(e); }
}

export async function PATCH(req: Request) {
  try {
    requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return applyCors(jsonError("شناسه افزونه الزامی است.", 400), req.headers.get("origin"));
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name.trim().slice(0, 120);
    if (typeof body.description === "string") data.description = body.description.trim().slice(0, 500) || null;
    if (typeof body.version === "string") data.version = body.version.trim().slice(0, 40);
    if (typeof body.enabled === "boolean") data.enabled = body.enabled;
    if (typeof body.manifest === "string") data.manifest = body.manifest.slice(0, 20000);
    const plugin = await db.plugin.update({ where: { id }, data });
    return applyCors(jsonOk({ plugin }), req.headers.get("origin"));
  } catch (e) { return toErrorResponse(e); }
}

export async function DELETE(req: Request) {
  try {
    requireAdmin(req);
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!id) return applyCors(jsonError("شناسه افزونه الزامی است.", 400), req.headers.get("origin"));
    await db.plugin.delete({ where: { id } });
    return applyCors(jsonOk({ ok: true }), req.headers.get("origin"));
  } catch (e) { return toErrorResponse(e); }
}
