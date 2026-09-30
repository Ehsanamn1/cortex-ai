import { db } from "@/lib/db";
import { CORTEX_UI_CONFIG } from "@/config/cortex-ui";

export const DEFAULT_SITE_SETTINGS: Record<string, string> = {
  "site.name": CORTEX_UI_CONFIG.brand.name,
  "site.description": "ساخت و مدیریت ایجنت‌های هوش مصنوعی با دانش واقعی کسب‌وکار.",
  "site.supportEmail": "",
  "site.maxUploadMb": String(CORTEX_UI_CONFIG.limits.maxKnowledgeUploadMb),
  "site.welcomeTitle": "محیط مدیریت دانش و ایجنت‌ها",
  "site.heroTitle": "دانش کسب‌وکارت را به ایجنت‌های قابل‌اعتماد تبدیل کن.",
  "site.heroSubtitle": "Cortex دانش، Agent، Telegram و کنترل هزینه را در یک محیط عملیاتی جمع می‌کند؛ برای پاسخ بهتر، تصمیم سریع‌تر و کار کمتر.",
  "site.heroPrimaryCta": "ساخت اولین ایجنت",
  "site.heroSecondaryCta": "مشاهده قابلیت‌ها",
  "site.proofLine": "بدون قفل شدن به یک Provider · کنترل متمرکز مدل و هزینه · آماده برای Telegram",
  "site.primaryColor": CORTEX_UI_CONFIG.theme.primary,
  "site.secondaryColor": CORTEX_UI_CONFIG.theme.secondary,
  "site.radius": "0.75",
  "site.sidebarColor": CORTEX_UI_CONFIG.theme.sidebar,
  "site.authTitle": CORTEX_UI_CONFIG.copy.authTitle,
  "site.authDescription": CORTEX_UI_CONFIG.copy.authDescription,
  "site.navOrder": "dashboard,agents,knowledge,conversations,telegram,analytics,learn",
  "nav.dashboard.enabled": "true",
  "nav.dashboard.label": "داشبورد",
  "nav.agents.enabled": "true",
  "nav.agents.label": "ایجنت‌ها",
  "nav.knowledge.enabled": "true",
  "nav.knowledge.label": "پایگاه دانش",
  "nav.conversations.enabled": "true",
  "nav.conversations.label": "گفتگوها",
  "nav.telegram.enabled": "true",
  "nav.telegram.label": "تلگرام",
  "nav.analytics.enabled": "true",
  "nav.analytics.label": "تحلیل",
  "nav.admin.enabled": "false",
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

let publicSettingsCache: { at: number; value: Record<string, string> } | null = null;
const PUBLIC_SETTINGS_CACHE_MS = 30_000;

export async function getPublicSiteSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (publicSettingsCache && now - publicSettingsCache.at < PUBLIC_SETTINGS_CACHE_MS) {
    return { ...publicSettingsCache.value };
  }

  const values: Record<string, string> = { ...DEFAULT_SITE_SETTINGS };
  try {
    const rows = await db.siteSetting.findMany({
      where: { key: { in: Object.keys(DEFAULT_SITE_SETTINGS) } },
      select: { key: true, value: true },
    });
    for (const row of rows) values[row.key] = row.value;
  } catch {
    // Settings are optional; the shell must still render with defaults.
    if (publicSettingsCache) return { ...publicSettingsCache.value };
  }

  values["nav.admin.enabled"] = "false";
  values["site.navOrder"] = values["site.navOrder"].split(",").filter((item) => item.trim() !== "admin").join(",");
  publicSettingsCache = { at: now, value: { ...values } };
  return { ...values };
}
