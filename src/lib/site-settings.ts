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
  "site.navOrder": "dashboard,agents,knowledge,conversations,telegram,analytics,admin,learn",
  "nav.dashboard.enabled": "true",
  "nav.dashboard.label": "داشبورد",
  "nav.agents.enabled": "true",
  "nav.agents.label": "ایجنت‌ها",
  "nav.knowledge.enabled": "true",
  "nav.knowledge.label": "مغز شرکت",
  "nav.conversations.enabled": "true",
  "nav.conversations.label": "گفتگوها",
  "nav.telegram.enabled": "true",
  "nav.telegram.label": "تلگرام",
  "nav.analytics.enabled": "true",
  "nav.analytics.label": "تحلیل",
  "nav.admin.enabled": "true",
  "nav.admin.label": "مدیریت",
  "nav.learn.enabled": "true",
  "nav.learn.label": "آموزش",
  "feature.dashboardHero": "true",
  "feature.dashboardQuickActions": "true",
  "feature.dashboardRecent": "true",
  "feature.dashboardActivity": "true",
  "feature.authBrandPanel": "true",
  "feature.createAgentCta": "true",
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
    // Settings are optional; the shell must still render with defaults.
  }
  return values;
}
