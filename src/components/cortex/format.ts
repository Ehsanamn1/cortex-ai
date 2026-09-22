import type { AgentLanguage, AgentTone } from "@/lib/cortex-client";

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Latin digits → Persian digits. */
export function faNum(value: number | string): string {
  return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/** Compact Persian relative time («۳ دقیقه پیش», «دیروز»...). */
export function timeAgoFa(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);

  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });

  if (abs < 60) return rtf.format(seconds, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(seconds / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(seconds / 2592000), "month");
  return rtf.format(Math.round(seconds / 31536000), "year");
}

/** Short Persian clock time (HH:MM). */
export function formatTimeFa(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Long Persian date (e.g. «۱۵ مهر ۱۴۰۳»). */
export function formatDateFa(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(date);
}

/** Human file size, e.g. ۲.۴ مگابایت */
export function formatSizeFa(bytes: number): string {
  if (bytes < 1024) return `${faNum(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${faNum((bytes / 1024).toFixed(0))} کیلوبایت`;
  return `${faNum((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
}

export function languageLabel(language: AgentLanguage): string {
  return language === "fa" ? "فارسی" : "English";
}

export function toneLabel(tone: AgentTone, customTone?: string | null): string {
  switch (tone) {
    case "professional":
      return "حرفه‌ای";
    case "friendly":
      return "دوستانه";
    case "concise":
      return "مختصر";
    case "formal":
      return "رسمی";
    case "custom":
      return customTone?.trim() ? customTone.trim() : "سفارشی";
  }
}

/** Up to two Persian/ Latin initials for avatars. */
export function initialsOf(name: string | null | undefined, fallback = "ک"): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return fallback;
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] ?? "").join("");
}

/** firstName for greetings. */
export function firstNameOf(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}
