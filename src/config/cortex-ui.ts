export type CortexView = "dashboard" | "workflows" | "agents" | "knowledge" | "conversations" | "telegram" | "analytics" | "billing" | "admin" | "learn";

export const CORTEX_UI_CONFIG = {
  brand: {
    name: "Cortex AI",
    eyebrow: "CORTEX WORKSPACE",
    authBadge: "INTELLIGENCE OS",
  },
  theme: {
    primary: "#356DFF",
    secondary: "#60708A",
    radius: "0.75rem",
    sidebar: "#0F141B",
  },
  limits: {
    maxKnowledgeUploadMb: 20,
  },
  navigation: [
    { view: "dashboard" as CortexView, label: "داشبورد", mobile: true },
    { view: "billing" as CortexView, label: "پلن و اعتبار", mobile: true },
    { view: "agents" as CortexView, label: "ایجنت‌ها", mobile: true },
    { view: "knowledge" as CortexView, label: "پایگاه دانش", mobile: false },
    { view: "conversations" as CortexView, label: "گفتگوها", mobile: false },
    { view: "telegram" as CortexView, label: "تلگرام", mobile: false },
    { view: "analytics" as CortexView, label: "تحلیل", mobile: false },
    { view: "workflows" as CortexView, label: "گردش‌کارها", mobile: false },
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

const CORTEX_PRIMARY_PALETTE = new Set([
  "#356DFF",
  "#6D94FF",
  "#244FC0",
]);

const CORTEX_SECONDARY_PALETTE = new Set([
  "#60708A",
  "#8CA0B8",
  "#33465C",
]);

export function isSafeHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function isCortexPrimaryColor(value: string): boolean {
  return CORTEX_PRIMARY_PALETTE.has(value.toUpperCase());
}

export function isCortexSecondaryColor(value: string): boolean {
  return CORTEX_SECONDARY_PALETTE.has(value.toUpperCase());
}

export function normalizeThemeSettings(
  input: Partial<Record<keyof CortexThemeSettings, string>>,
): CortexThemeSettings {
  const primary = input.primary && isCortexPrimaryColor(input.primary)
    ? input.primary
    : CORTEX_UI_CONFIG.theme.primary;
  const secondary = input.secondary && isCortexSecondaryColor(input.secondary)
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
