import { db } from '@/lib/db';
import { decryptSecret } from '@/lib/server/secrets';
import { estimateTokens } from '@/lib/server/audit';
import { releaseUsageReservation, reserveUsageWithinLimits } from '@/lib/server/usage';
import { audit } from '@/lib/server/audit';
import { answerWithKnowledge, toRetrievalDebug, toSourceRefs } from '@/lib/rag/pipeline';
import { normalizeTelegramPhone } from '@/lib/telegram/phone';

const API = 'https://api.telegram.org';

type SendOptions = {
  parse_mode?: 'HTML';
  reply_markup?: Record<string, unknown>;
};

class TelegramApiError extends Error {
  retryable: boolean;
  retryAfterMs: number;

  constructor(message: string, retryable: boolean, retryAfterMs = 0) {
    super(message);
    this.name = 'TelegramApiError';
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

async function telegramCall(token: string, method: string, body: Record<string, unknown>) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(API + '/bot' + token + '/' + method, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });

      const data = await res.json() as {
        ok?: boolean;
        result?: any;
        description?: string;
        parameters?: { retry_after?: number };
      };

      if (res.ok && data.ok) return data.result;

      const retryAfter = Number(data.parameters?.retry_after ?? 0);
      const retryable = res.status === 429 || res.status >= 500;
      const error = new TelegramApiError(
        data.description || ('Telegram API ' + res.status),
        retryable,
        retryAfter * 1000,
      );

      if (!retryable || attempt === 2) throw error;

      const delay = Math.min(8_000, Math.max(500, error.retryAfterMs || 750 * (attempt + 1)));
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof TelegramApiError) {
        if (!error.retryable || attempt === 2) throw error;
        const delay = Math.min(8_000, Math.max(500, error.retryAfterMs || 750 * (attempt + 1)));
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (attempt === 2) throw lastError;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error('Telegram API unavailable');
}

export async function getBotInfo(token: string) {
  return telegramCall(token, 'getMe', {});
}

export async function configureBotProfile(token: string, botName: string) {
  const safeName = botName.trim().slice(0, 32);

  await telegramCall(token, 'setMyName', { name: safeName }).catch(() => undefined);
  await telegramCall(token, 'setMyShortDescription', {
    short_description: 'دستیار هوشمند Cortex برای پاسخ‌گویی و مدیریت دانش.',
  }).catch(() => undefined);
  await telegramCall(token, 'setMyDescription', {
    description: 'دستیار هوشمند Cortex؛ متصل به دانش و ایجنت اختصاصی شما.',
  }).catch(() => undefined);
  await telegramCall(token, 'setMyCommands', {
    commands: [
      { command: 'start', description: 'شروع و بررسی دسترسی' },
      { command: 'newchat', description: 'شروع گفتگوی جدید' },
      { command: 'help', description: 'راهنمای استفاده' },
      { command: 'usage', description: 'مشاهده مصرف توکن' },
    ],
  }).catch(() => undefined);
  await telegramCall(token, 'setChatMenuButton', {
    menu_button: { type: 'commands' },
  }).catch(() => undefined);
}

export async function setWebhook(token: string, url: string, secret: string) {
  return telegramCall(token, 'setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
  });
}

export async function deleteWebhook(token: string) {
  return telegramCall(token, 'deleteWebhook', { drop_pending_updates: false });
}

export async function sendMessage(
  token: string,
  chatId: string | number,
  text: string,
  options: SendOptions = {},
) {
  const value = text.trim();
  const chunks: string[] = [];

  // Rich templates are kept below Telegram's limit. Long AI answers are sent as plain text.
  for (let i = 0; i < value.length; i += 4096) chunks.push(value.slice(i, i + 4096));

  const results: unknown[] = [];
  for (const chunk of chunks.length ? chunks : ['']) {
    results.push(await telegramCall(token, 'sendMessage', {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: true,
      ...options,
    }));
  }

  return results.at(-1);
}

async function sendChatAction(token: string, chatId: string | number, action: string) {
  return telegramCall(token, 'sendChatAction', { chat_id: chatId, action });
}

async function answerCallback(token: string, callbackId: string) {
  return telegramCall(token, 'answerCallbackQuery', { callback_query_id: callbackId });
}

export async function requestContact(token: string, chatId: string | number) {
  return sendMessage(
    token,
    chatId,
    '<b>🔐 یک مرحله امنیتی</b>\n\nبرای شناسایی و بررسی دسترسی، شماره موبایل خودتان را با دکمه زیر ارسال کنید.\n\nفقط شماره‌هایی که در پنل Cortex ثبت شده‌اند اجازه استفاده دارند.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [[{ text: '📱 ارسال شماره موبایل', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: false,
        is_persistent: true,
        selective: false,
        input_field_placeholder: 'ابتدا دکمه ارسال شماره را بزنید…',
      },
    },
  );
}

async function sendWelcome(token: string, chatId: string | number, allowed: boolean) {
  if (!allowed) {
    await sendMessage(
      token,
      chatId,
      '<b>سلام 👋</b>\n\nبه دستیار هوشمند <b>Cortex</b> خوش آمدید.\n\nبرای شروع، اول شماره موبایل خودتان را تأیید کنید.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '📖 Cortex چیست؟', callback_data: 'help' }]],
        },
      },
    );
    return requestContact(token, chatId);
  }

  return sendMessage(
    token,
    chatId,
    '<b>🧠 Cortex آماده است.</b>\n\nسؤال یا درخواستتان را بفرستید. از ایجنت و دانش متصل‌شده استفاده می‌کنم.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [{ text: '💬 گفتگوی جدید' }, { text: '📊 مصرف من' }],
          [{ text: '❓ راهنما' }],
        ],
        resize_keyboard: true,
        is_persistent: true,
        input_field_placeholder: 'پیامتان را بنویسید…',
      },
    },
  );
}

async function sendHelp(token: string, chatId: string | number) {
  return sendMessage(
    token,
    chatId,
    '<b>راهنمای Cortex</b>\n\n💬 پیام عادی → پاسخ از ایجنت\n🆕 /newchat → گفتگوی جدید\n📊 /usage → مصرف توکن\n🔄 /start → منوی اصلی\n\nبرای پاسخ دقیق‌تر، سؤال را کامل و واضح بفرستید.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '💬 شروع گفتگوی جدید', callback_data: 'new_chat' },
          { text: '📊 مصرف من', callback_data: 'usage' },
        ]],
      },
    },
  );
}

function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatUsage(value: number, limit: number) {
  const used = Number(value).toLocaleString('fa-IR');
  return limit > 0
    ? used + ' / ' + Number(limit).toLocaleString('fa-IR') + ' توکن'
    : used + ' توکن';
}

async function sendUsage(token: string, chatId: string | number, telegramUserId: string) {
  const user = await db.telegramUser.findUnique({ where: { id: telegramUserId } });
  if (!user) return;

  const [daily, monthly] = await Promise.all([
    db.usageEvent.aggregate({
      where: { telegramUserId: user.id, createdAt: { gte: startOfDay() } },
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
    db.usageEvent.aggregate({
      where: { telegramUserId: user.id, createdAt: { gte: startOfMonth() } },
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
  ]);

  return sendMessage(
    token,
    chatId,
    '<b>📊 وضعیت مصرف</b>\n\n' +
      'امروز: <b>' + formatUsage(daily._sum.totalTokens ?? 0, user.dailyTokenLimit) + '</b>\n' +
      'این ماه: <b>' + formatUsage(monthly._sum.totalTokens ?? 0, user.monthlyTokenLimit) + '</b>\n\n' +
      'پیام امروز: ' + Number(daily._count._all).toLocaleString('fa-IR') + '\n' +
      'پیام این ماه: ' + Number(monthly._count._all).toLocaleString('fa-IR'),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '💬 ادامه گفتگو', callback_data: 'new_chat' }]],
      },
    },
  );
}

async function createTelegramConversation(botId: string, agentId: string, telegramUserId: string) {
  return db.conversation.create({
    data: {
      agentId,
      userId: null,
      title: 'گفتگوی تلگرام',
      channel: 'telegram',
      externalUserId: telegramUserId,
      telegramBotId: botId,
    },
  });
}

export async function processTelegramUpdate(botId: string, update: any) {
  const bot = await db.telegramBot.findUnique({ where: { id: botId } });
  if (!bot) return;

  const updateId = Number(update?.update_id);
  if (Number.isInteger(updateId)) {
    const claimed = await db.telegramBot.updateMany({
      where: { id: botId, lastUpdateId: { lt: updateId } },
      data: { lastUpdateId: updateId },
    });
    if (claimed.count === 0) return;
  }

  const token = decryptSecret(bot.tokenEncrypted);
  const callback = update?.callback_query;

  if (callback) {
    const tgId = String(callback.from?.id ?? '');
    const chatId = callback.message?.chat?.id;
    if (!tgId || chatId == null) return;

    const user = await db.telegramUser.findUnique({
      where: { botId_telegramUserId: { botId, telegramUserId: tgId } },
    });
    await answerCallback(token, String(callback.id)).catch(() => undefined);

    if (!user) return;
    if (user.status === 'blocked') {
      await sendMessage(token, chatId, '⛔ دسترسی این حساب مسدود است.');
      return;
    }

    const data = String(callback.data ?? '');
    if (data === 'help') {
      await sendHelp(token, chatId);
    } else if (data === 'usage') {
      if (user.status !== 'allowed') return requestContact(token, chatId);
      await sendUsage(token, chatId, user.id);
    } else if (data === 'new_chat') {
      if (user.status !== 'allowed') return requestContact(token, chatId);
      await createTelegramConversation(bot.id, bot.agentId, tgId);
      await sendMessage(token, chatId, '✅ گفتگوی جدید آماده است. پیام بعدی‌تان را بفرستید.');
    }
    return;
  }

  const msg = update?.message;
  if (!msg) return;

  const tgId = String(msg.from?.id ?? msg.chat?.id ?? '');
  if (!tgId || msg.chat?.id == null) return;

  const user = await db.telegramUser.upsert({
    where: { botId_telegramUserId: { botId, telegramUserId: tgId } },
    update: {
      username: msg.from?.username ?? undefined,
      firstName: msg.from?.first_name ?? undefined,
      lastName: msg.from?.last_name ?? undefined,
      lastSeenAt: new Date(),
    },
    create: {
      botId,
      telegramUserId: tgId,
      username: msg.from?.username ?? null,
      firstName: msg.from?.first_name ?? null,
      lastName: msg.from?.last_name ?? null,
      lastSeenAt: new Date(),
    },
  });

  const contactPhone = msg.contact?.phone_number ? normalizeTelegramPhone(msg.contact.phone_number) : '';

  if (contactPhone) {
    const sharedUserId = msg.contact?.user_id != null ? String(msg.contact.user_id) : '';

    if (sharedUserId && sharedUserId !== tgId) {
      await db.telegramUser.update({
        where: { id: user.id },
        data: { phoneNumber: contactPhone, status: 'blocked' },
      });
      await audit({
        workspaceId: bot.workspaceId,
        userId: null,
        action: 'telegram.contact_rejected',
        entityType: 'TelegramUser',
        entityId: user.id,
        metadata: { reason: 'contact_user_mismatch' },
      });
      await sendMessage(token, msg.chat.id, '⛔ این شماره متعلق به حساب تلگرام شما نیست. از دکمه ارسال شماره خودتان استفاده کنید.');
      return;
    }

    const allowed = await db.telegramAllowlistEntry.findUnique({
      where: { botId_phoneNumber: { botId, phoneNumber: contactPhone } },
    });

    const nextStatus = allowed?.status === 'allowed' ? 'allowed' : 'pending';

    await db.telegramUser.update({
      where: { id: user.id },
      data: { phoneNumber: contactPhone, status: nextStatus },
    });

    await audit({
      workspaceId: bot.workspaceId,
      userId: null,
      action: 'telegram.user_' + nextStatus,
      entityType: 'TelegramUser',
      entityId: user.id,
      metadata: { phoneNumber: contactPhone },
    });

    if (nextStatus === 'allowed') {
      await sendMessage(token, msg.chat.id, '✅ شماره شما تأیید شد.', {
        reply_markup: { remove_keyboard: true },
      });
      await sendWelcome(token, msg.chat.id, true);
    } else {
      await sendMessage(token, msg.chat.id, '⏳ این شماره فعلاً در فهرست دسترسی ربات نیست. بعد از ثبت شماره توسط مدیر، دوباره /start را بزنید.');
      await requestContact(token, msg.chat.id);
    }
    return;
  }

  if (user.status === 'blocked') {
    await sendMessage(token, msg.chat.id, '⛔ دسترسی این حساب مسدود است. برای فعال‌سازی با مدیر سامانه تماس بگیرید.');
    return;
  }

  const rawText = typeof msg.text === 'string' ? msg.text.trim() : '';
  const command = rawText.split(/\s+/)[0]?.split('@')[0]?.toLowerCase();

  if (command === '/start' || command === '/newchat' || command === '/help' || command === '/usage') {
    if (user.status !== 'allowed') return sendWelcome(token, msg.chat.id, false);
    if (command === '/help') return sendHelp(token, msg.chat.id);
    if (command === '/usage') return sendUsage(token, msg.chat.id, user.id);
    if (command === '/start') return sendWelcome(token, msg.chat.id, true);

    await createTelegramConversation(bot.id, bot.agentId, tgId);
    await sendMessage(token, msg.chat.id, '✅ گفتگوی جدید آماده است. پیام بعدی‌تان را بفرستید.');
    return;
  }

  if (!rawText) return;

  const quickAction = rawText.toLowerCase();
  if (user.status === 'allowed' && (quickAction === '💬 گفتگوی جدید' || quickAction === '📊 مصرف من' || quickAction === '❓ راهنما')) {
    if (quickAction === '📊 مصرف من') return sendUsage(token, msg.chat.id, user.id);
    if (quickAction === '❓ راهنما') return sendHelp(token, msg.chat.id);
    await createTelegramConversation(bot.id, bot.agentId, tgId);
    await sendMessage(token, msg.chat.id, '✅ گفتگوی جدید آماده است. پیام بعدی‌تان را بفرستید.');
    return;
  }

  if (user.status !== 'allowed') return sendWelcome(token, msg.chat.id, false);

  await sendChatAction(token, msg.chat.id, 'typing').catch(() => undefined);

  let reservationId: string | null = null;
  try {
    const botAgent = await db.agent.findUniqueOrThrow({ where: { id: bot.agentId } });

    let conversation = await db.conversation.findFirst({
      where: {
        agentId: bot.agentId,
        telegramBotId: bot.id,
        externalUserId: tgId,
        channel: 'telegram',
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!conversation) conversation = await createTelegramConversation(bot.id, bot.agentId, tgId);

    const history = await db.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 24,
    }).then((rows) => rows.reverse());

    const promptHistory = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-12);

    const estimatedPromptTokens =
      promptHistory.reduce((sum, item) => sum + estimateTokens(item.content), 0) +
      estimateTokens(rawText);

    // Reserve the whole bounded request budget before the model call so
    // concurrent Telegram updates cannot race past the configured quota.
    reservationId = await reserveUsageWithinLimits(
      bot.workspaceId,
      1,
      estimatedPromptTokens,
      botAgent.maxTokens,
      user.id,
    );

    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: rawText,
      },
    });

    const answer = await answerWithKnowledge({
      agentId: bot.agentId,
      workspaceId: bot.workspaceId,
      persona: botAgent,
      history: promptHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      question: rawText,
    });

    const metadata = {
      sources: toSourceRefs(answer.retrieval),
      retrieval: toRetrievalDebug(answer.retrieval),
      provider: answer.provider,
      model: answer.model,
      latencyMs: answer.latencyMs,
    };

    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: answer.content,
        metadata: JSON.stringify({ ...metadata, conversationId: conversation.id }),
      },
    });

    await db.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    const inputTokens = estimatedPromptTokens;
    const outputTokens = estimateTokens(answer.content);

    await db.$transaction([
      db.usageEvent.create({
        data: {
          workspaceId: bot.workspaceId,
          agentId: bot.agentId,
          telegramBotId: bot.id,
          telegramUserId: user.id,
          channel: 'telegram',
          provider: answer.provider,
          model: answer.model,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
      }),
      ...(reservationId ? [db.usageReservation.delete({ where: { id: reservationId } })] : []),
    ]);
    reservationId = null;

    await db.telegramBot.update({
      where: { id: bot.id },
      data: { status: 'connected', lastSeenAt: new Date(), lastError: null },
    });

    await sendMessage(token, msg.chat.id, answer.content);
  } catch (error) {
    await releaseUsageReservation(reservationId);
    reservationId = null;
    if (error && typeof error === 'object' && 'status' in error && Number((error as { status?: unknown }).status) === 429) {
      const message = error instanceof Error ? error.message : 'سقف مصرف این کاربر پر شده است.';
      await sendMessage(token, msg.chat.id, '⏳ ' + message + '\n\nبرای ادامه، سقف مصرف باید توسط مدیر افزایش پیدا کند.').catch(() => undefined);
      return;
    }

    console.error('[cortex][telegram] message processing failed:', error);

    await db.telegramBot.update({
      where: { id: bot.id },
      data: {
        status: 'error',
        lastError: error instanceof Error ? error.message.slice(0, 1000) : 'خطای ناشناخته',
      },
    }).catch(() => undefined);

    await sendMessage(
      token,
      msg.chat.id,
      '⚠️ در پردازش این پیام مشکلی پیش آمد. لطفاً چند لحظه بعد دوباره تلاش کنید.',
    ).catch(() => undefined);
  }
}
