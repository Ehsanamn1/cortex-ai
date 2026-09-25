export type CortexView = "dashboard" | "workflows" | "agents" | "knowledge" | "conversations" | "telegram" | "analytics" | "admin" | "learn";

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
    maxKnowledgeUploadMb: 20,
  },
  navigation: [
    { view: "dashboard" as CortexView, label: "داشبورد", mobile: true },
    { view: "workflows" as CortexView, label: "Workflow", mobile: false },
    { view: "agents" as CortexView, label: "ایجنت‌ها", mobile: true },
    { view: "knowledge" as CortexView, label: "مغز شرکت", mobile: true },
    { view: "conversations" as CortexView, label: "گفتگوها", mobile: true },
    { view: "telegram" as CortexView, label: "تلگرام", mobile: false },
    { view: "analytics" as CortexView, label: "تحلیل", mobile: false },
    { view: "admin" as CortexView, label: "مدیریت", mobile: false },
    { view: "learn" as CortexView, label: "آموزش", mobile: false },
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

export function normalizeThemeSettings(
  input: Partial<Record<keyof CortexThemeSettings, string>>,
): CortexThemeSettings {
  const primary = input.primary && isSafeHexColor(input.primary)
    ? input.primary
    : CORTEX_UI_CONFIG.theme.primary;
  const secondary = input.secondary && isSafeHexColor(input.secondary)
    ? input.secondary
    : CORTEX_UI_CONFIG.theme.secondary;
  const sidebar = input.sidebar && isSafeHexColor(input.sidebar)
    ? input.sidebar
    : CORTEX_UI_CONFIG.theme.sidebar;
  const radiusNumber = Number.parseFloat(input.radius ?? "");
  const radius =
    Number.isFinite(radiusNumber) && radiusNumber >= 0.25 && radiusNumber <= 2
      ? radiusNumber + "rem"
      : CORTEX_UI_CONFIG.theme.radius;
  return { primary, secondary, radius, sidebar };
}
