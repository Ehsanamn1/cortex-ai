import { db } from "@/lib/db";

export const DEFAULT_SITE_SETTINGS: Record<string, string> = {
  "site.name": "Cortex AI",
  "site.description": "ساخت و مدیریت ایجنت‌های هوش مصنوعی با دانش واقعی کسب‌وکار.",
  "site.supportEmail": "",
  "site.maxUploadMb": "200",
  "site.welcomeTitle": "هوش کسب‌وکار را از یک داشبورد کنترل کن.",
};

export async function getPublicSiteSettings(): Promise<Record<string, string>> {
  const values: Record<string, string> = { ...DEFAULT_SITE_SETTINGS };
  try {
    const rows = await db.siteSetting.findMany({
      where: { key: { in: Object.keys(DEFAULT_SITE_SETTINGS) } },
      select: { key: true, value: true },
    });
    for (const row of rows) values[row.key] = row.value;
  } catch {
    // Optional CMS settings must never prevent the product shell from loading.
  }
  return values;
}
