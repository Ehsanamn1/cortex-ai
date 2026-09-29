import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const profileCache = new Map<string, { expiresAt: number; value: any }>();

export const TELEGRAM_PROFILE_DEFAULTS = {
  displayName: "",
  shortDescription: "دستیار هوشمند Cortex برای پاسخ‌گویی و مدیریت دانش.",
  description: "دستیار هوشمند Cortex؛ متصل به دانش و ایجنت اختصاصی شما.",
  welcomeTitle: "✨ خوش آمدید",
  welcomeText: "من دستیار هوشمند Cortex هستم و به دانش و ایجنت این ربات متصل‌ام.\n\nبرای ورود امن، شماره موبایل خود را با دکمه «ارسال شماره موبایل» تأیید کنید. 🚀",
  welcomeBannerUrl: "",
  helpText: "💬 پیام عادی → پاسخ از ایجنت\n🆕 گفتگوی جدید → یک conversation تازه\n📊 مصرف → وضعیت استفاده\n\nسؤال را کامل و واضح بفرستید.",
  newChatText: "✅ گفتگوی جدید آماده است. پیام بعدی‌تان را بفرستید.",
  blockedText: "⛔ دسترسی این حساب مسدود است.",
  errorText: "⚠️ در پردازش این پیام مشکلی پیش آمد. لطفاً چند لحظه بعد دوباره تلاش کنید.",
  accessRequiredText: "🔐 برای استفاده از این دستیار، ابتدا شماره موبایل خود را با دکمه زیر ارسال کنید تا Cortex دسترسی شما را بررسی کند. اگر شماره از قبل در پنل مجاز شده باشد، دسترسی شما همان لحظه فعال می‌شود.",
  thinkingMessages: ["🧠 در حال فکر کردن…", "🔎 در حال بررسی اطلاعات…", "✍️ در حال آماده‌سازی پاسخ…"],
  newChatButtonText: "🆕 گفتگوی جدید",
  helpButtonText: "❓ راهنما",
  usageButtonText: "📊 مصرف",
  showThinking: true,
  showWelcomeBanner: false,
  commands: [
    { command: "start", description: "شروع" },
    { command: "newchat", description: "گفتگوی جدید" },
    { command: "help", description: "راهنما" },
    { command: "usage", description: "مصرف" },
  ] as Array<{ command: string; description: string }>,
};

export function parseTelegramProfile(raw: any) {
  let thinkingMessages = TELEGRAM_PROFILE_DEFAULTS.thinkingMessages;
  let commands = TELEGRAM_PROFILE_DEFAULTS.commands;
  try {
    const parsed = raw.thinkingMessages ? JSON.parse(raw.thinkingMessages) : null;
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      thinkingMessages = parsed.slice(0, 8).map((v) => v.trim()).filter(Boolean);
    }
  } catch {}
  try {
    const parsed = raw.commandsJson ? JSON.parse(raw.commandsJson) : null;
    if (Array.isArray(parsed)) {
      commands = parsed
        .filter((v) => v && typeof v.command === "string" && typeof v.description === "string")
        .slice(0, 12)
        .map((v) => ({ command: v.command.replace(/^\//, "").slice(0, 32), description: v.description.slice(0, 256) }));
    }
  } catch {}
  const merged = {
    botId: raw.botId,
    ...TELEGRAM_PROFILE_DEFAULTS,
    ...raw,
    welcomeBannerUrl: raw.welcomeBannerUrl ?? "",
    thinkingMessages: thinkingMessages.length ? thinkingMessages : TELEGRAM_PROFILE_DEFAULTS.thinkingMessages,
    commands,
  };

  // Profiles created by older builds carried copy that required a pre-approved
  // phone number or explicitly said no phone was needed. Normalize those legacy
  // defaults at read time so existing bots follow the current onboarding flow
  // without requiring a data migration.
  const legacyWelcomeText =
    "من دستیار هوشمند Cortex هستم و به دانش و ایجنت این ربات متصل‌ام.\n\nبدون ثبت شماره موبایل شروع کنید؛ فقط پیام‌تان را بفرستید. 🚀";
  const legacyAccessText =
    "🔐 برای استفاده از این دستیار، مدیر کسب‌وکار باید شماره شما را در پنل ثبت کند و لینک ورود را برایتان بفرستد.";
  if (!raw.welcomeText || String(raw.welcomeText).trim() === legacyWelcomeText) {
    merged.welcomeText = TELEGRAM_PROFILE_DEFAULTS.welcomeText;
  }
  if (!raw.accessRequiredText || String(raw.accessRequiredText).trim() === legacyAccessText) {
    merged.accessRequiredText = TELEGRAM_PROFILE_DEFAULTS.accessRequiredText;
  }

  return merged;
}

async function loadProfileFromDb(botId: string) {
  const existing = await db.telegramBotProfile.findUnique({ where: { botId } });
  if (existing) return parseTelegramProfile(existing);

  const created = await db.telegramBotProfile.create({
    data: {
      botId,
      shortDescription: TELEGRAM_PROFILE_DEFAULTS.shortDescription,
      description: TELEGRAM_PROFILE_DEFAULTS.description,
      welcomeTitle: TELEGRAM_PROFILE_DEFAULTS.welcomeTitle,
      welcomeText: TELEGRAM_PROFILE_DEFAULTS.welcomeText,
      helpText: TELEGRAM_PROFILE_DEFAULTS.helpText,
      newChatText: TELEGRAM_PROFILE_DEFAULTS.newChatText,
      blockedText: TELEGRAM_PROFILE_DEFAULTS.blockedText,
      errorText: TELEGRAM_PROFILE_DEFAULTS.errorText,
      accessRequiredText: TELEGRAM_PROFILE_DEFAULTS.accessRequiredText,
      thinkingMessages: JSON.stringify(TELEGRAM_PROFILE_DEFAULTS.thinkingMessages),
      newChatButtonText: TELEGRAM_PROFILE_DEFAULTS.newChatButtonText,
      helpButtonText: TELEGRAM_PROFILE_DEFAULTS.helpButtonText,
      usageButtonText: TELEGRAM_PROFILE_DEFAULTS.usageButtonText,
      showThinking: true,
      showWelcomeBanner: false,
      commandsJson: JSON.stringify(TELEGRAM_PROFILE_DEFAULTS.commands),
    },
  });
  return parseTelegramProfile(created);
}

export async function getTelegramBotProfile(botId: string) {
  const cached = profileCache.get(botId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await loadProfileFromDb(botId);
  profileCache.set(botId, { expiresAt: Date.now() + 20_000, value });
  return value;
}

export function invalidateTelegramBotProfile(botId: string) {
  profileCache.delete(botId);
}

export type TelegramBotCommand = { command: string; description: string };

export function normalizeTelegramCommands(input: unknown): TelegramBotCommand[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const commands: TelegramBotCommand[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const rawCommand = typeof (item as any).command === "string" ? String((item as any).command).trim().replace(/^\//, "").toLowerCase() : "";
    const description = typeof (item as any).description === "string" ? String((item as any).description).trim().slice(0, 256) : "";
    if (!/^[a-z0-9_]{1,32}$/.test(rawCommand) || !description) continue;
    if (seen.has(rawCommand)) continue;
    seen.add(rawCommand);
    commands.push({ command: rawCommand, description });
    if (commands.length >= 12) break;
  }
  return commands;
}

export function profileUpdateData(input: Record<string, unknown>): Prisma.TelegramBotProfileUpdateInput {
  const data: Prisma.TelegramBotProfileUpdateInput = {};
  const textFields = [
    "displayName","shortDescription","description","welcomeTitle","welcomeText","welcomeBannerUrl",
    "helpText","newChatText","blockedText","errorText","accessRequiredText","newChatButtonText","helpButtonText","usageButtonText",
  ] as const;
  for (const field of textFields) {
    if (typeof input[field] === "string") {
      data[field] = String(input[field]).trim().slice(0, field === "welcomeText" || field === "helpText" ? 3000 : 512);
    }
  }
  if (typeof input.showThinking === "boolean") data.showThinking = input.showThinking;
  if (typeof input.showWelcomeBanner === "boolean") data.showWelcomeBanner = input.showWelcomeBanner;
  if (Array.isArray(input.thinkingMessages)) {
    const values = input.thinkingMessages
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim().slice(0, 180))
      .filter(Boolean)
      .slice(0, 8);
    data.thinkingMessages = JSON.stringify(values.length ? values : TELEGRAM_PROFILE_DEFAULTS.thinkingMessages);
  }
  if (Array.isArray(input.commands)) {
    const raw = input.commands;
    const commands = normalizeTelegramCommands(raw);
    const hadNonEmptyItems = raw.some((item) => item && typeof item === "object");
    if (hadNonEmptyItems && commands.length === 0) {
      throw Object.assign(new Error("فرمت Command نامعتبر است. فقط حروف انگلیسی کوچک، عدد و _ و حداکثر ۳۲ کاراکتر مجاز است."), { status: 400 });
    }
    data.commandsJson = JSON.stringify(commands.length ? commands : TELEGRAM_PROFILE_DEFAULTS.commands);
  }
  if (typeof input.welcomeBannerUrl === "string") {
    const value = input.welcomeBannerUrl.trim();
    if (value && !/^https:\/\//i.test(value)) {
      throw Object.assign(new Error("آدرس بنر باید با https شروع شود."), { status: 400 });
    }
  }
  return data;
}
