import { db } from "@/lib/db";
import { CORTEX_UI_CONFIG } from "@/config/cortex-ui";

export const DEFAULT_SITE_SETTINGS: Record<string, string> = {
  "site.name": CORTEX_UI_CONFIG.brand.name,
  "site.description": "ساخت و مدیریت ایجنت‌های هوش مصنوعی با دانش واقعی کسب‌وکار.",
  "site.supportEmail": "",
  "site.maxUploadMb": String(CORTEX_UI_CONFIG.limits.maxKnowledgeUploadMb),
  "site.welcomeTitle": CORTEX_UI_CONFIG.copy.welcomeTitle,
  "site.primaryColor": CORTEX_UI_CONFIG.theme.primary,
  "site.secondaryColor": CORTEX_UI_CONFIG.theme.secondary,
  "site.radius": "0.75",
  "site.sidebarColor": CORTEX_UI_CONFIG.theme.sidebar,
  "site.authTitle": CORTEX_UI_CONFIG.copy.authTitle,
  "site.authDescription": CORTEX_UI_CONFIG.copy.authDescription,
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
