import { db } from "@/lib/db";
import { applyCors, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin-auth";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const rows = await db.siteSetting.findMany({ orderBy: { key: "asc" } });
    const values: Record<string, string> = { ...DEFAULT_SITE_SETTINGS };
    for (const row of rows) values[row.key] = row.value;
    return applyCors(jsonOk({ settings: values }), req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: Request) {
  try {
    requireAdmin(req);
    const body = await readJson<Record<string, unknown>>(req);
    const values =
      body.settings && typeof body.settings === "object"
        ? (body.settings as Record<string, unknown>)
        : body;

    for (const key of Object.keys(DEFAULT_SITE_SETTINGS)) {
      if (typeof values[key] !== "string") continue;
      const value = values[key].slice(0, 4000);
      await db.siteSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value, type: "text" },
      });
    }

    return applyCors(jsonOk({ ok: true }), req.headers.get("origin"));
  } catch (error) {
    return toErrorResponse(error);
  }
}
