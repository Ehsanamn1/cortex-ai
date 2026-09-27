import { CORTEX_UI_CONFIG, normalizeThemeSettings } from "@/config/cortex-ui";

const CACHE_KEY = "cortex-ui-theme-cache-v1";
const CACHE_TTL = 5 * 60 * 1000;

type ThemeCache = { savedAt: number; settings: Record<string, string> };

export function applyCortexUiSettings(settings: Record<string, string>) {
  const theme = normalizeThemeSettings({
    primary: settings["site.primaryColor"],
    secondary: settings["site.secondaryColor"],
    radius: settings["site.radius"],
    sidebar: settings["site.sidebarColor"],
  });
  const root = document.documentElement;
  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--ring", theme.primary);
  root.style.setProperty("--secondary", theme.secondary);
  root.style.setProperty("--sidebar", theme.sidebar);
  root.style.setProperty("--radius", theme.radius);
}
