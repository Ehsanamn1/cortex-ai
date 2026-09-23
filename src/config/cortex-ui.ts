import type { View } from "@/components/cortex/store";

export const CORTEX_UI_CONFIG = {
  brand: {
    name: "Cortex AI",
    eyebrow: "CORTEX WORKSPACE",
    authBadge: "INTELLIGENCE OS",
  },
  theme: {
    primary: "#3B82FF",
    secondary: "#8B5CF6",
    radius: "0.75rem",
    sidebar: "#0A0D13",
  },
  limits: {
    maxKnowledgeUploadMb: 200,
  },
  navigation: [
    { view: "dashboard" as View, label: "داشبورد", mobile: true },
    { view: "agents" as View, label: "ایجنت‌ها", mobile: true },
    { view: "knowledge" as View, label: "دانش", mobile: true },
    { view: "conversations" as View, label: "گفتگوها", mobile: true },
    { view: "telegram" as View, label: "تلگرام", mobile: false },
    { view: "analytics" as View, label: "تحلیل", mobile: false },
    { view: "admin" as View, label: "مدیریت", mobile: false },
    { view: "learn" as View, label: "آموزش", mobile: false },
  ],
  copy: {
    welcomeTitle: "هوش کسب‌وکار را از یک داشبورد کنترل کن.",
    authTitle: "به Cortex AI خوش آمدید",
    authDescription: "برای ادامه، وارد حساب خود شوید یا یک فضای کاری جدید بسازید.",
  },
} as const;

export type CortexThemeSettings = {
  primary: string;
  secondary: string;
  radius: string;
  sidebar: string;
};

export function isSafeHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function normalizeThemeSettings(input: Partial<Record<keyof CortexThemeSettings, string>>): CortexThemeSettings {
  const primary = input.primary && isSafeHexColor(input.primary) ? input.primary : CORTEX_UI_CONFIG.theme.primary;
  const secondary = input.secondary && isSafeHexColor(input.secondary) ? input.secondary : CORTEX_UI_CONFIG.theme.secondary;
  const sidebar = input.sidebar && isSafeHexColor(input.sidebar) ? input.sidebar : CORTEX_UI_CONFIG.theme.sidebar;
  const radiusNumber = Number.parseFloat(input.radius ?? "");
  const radius = Number.isFinite(radiusNumber) && radiusNumber >= 0.25 && radiusNumber <= 2
    ? radiusNumber + "rem"
    : CORTEX_UI_CONFIG.theme.radius;
  return { primary, secondary, radius, sidebar };
}
