import { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin-auth";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

port { db } from "@/lib/db";
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin-auth";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export const DEFAULT_SITE_SETTINGS: Record<string,string> = {
  "site.name": "Cortex AI",
  "site.description": "ساخت و مدیریت ایجنت‌های هوش مصنوعی با دانش واقعی کسب‌وکار.",
  "site.supportEmail": "",
  "site.maxUploadMb": "20",
  "site.welcomeTitle": "ایجنت هوشمند خودت را بساز.",
};

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const rows = await db.siteSetting.findMany({ orderBy: { key: "asc" } });
    const values: Record<string,string> = { ...DEFAULT_SITE_SETTINGS };
    for (const row of rows) values[row.key] = row.value;
    return applyCors(jsonOk({ settings: values }), req.headers.get("origin"));
  } catch (e) { return toErrorResponse(e); }
}

export async function PUT(req: Request) {
  try {
    requireAdmin(req);
    const body = await readJson<Record<string,unknown>>(req);
    const allowed = Object.keys(DEFAULT_SITE_SETTINGS);
    const values = body.settings && typeof body.settings === "object" ? body.settings as Record<string,unknown> : body;
    for (const key of allowed) {
      if (typeof values[key] !== "string") continue;
      await db.siteSetting.upsert({
        where: { key },
        update: { value: values[key].slice(0, 4000) },
        create: { key, value: values[key].slice(0, 4000), type: "text" },
      });
    }
    return applyCors(jsonOk({ ok:true }), req.headers.get("origin"));
  } catch (e) { return toErrorResponse(e); }
}

/* Public-site settings are centralized in @/lib/site-settings. */
