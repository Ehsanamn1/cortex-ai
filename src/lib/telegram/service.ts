import { db } from '@/lib/db';
import { decryptSecret } from '@/lib/server/secrets';
import { estimateTokens } from '@/lib/server/audit';
import { releaseUsageReservation, reserveUsageWithinLimits } from '@/lib/server/usage';
import { RAG_QUERY_EXPANSION_RESERVE_TOKENS, toRetrievalDebug, toSourceRefs } from '@/lib/rag/pipeline';
import { normalizeTelegramPhone } from '@/lib/telegram/phone';
import { hashTelegramInviteToken, parseTelegramStartToken } from '@/lib/telegram/access';
import { getTelegramBotProfile } from '@/lib/telegram/profile';
import { releaseBillingReservation, reserveBillingForAgentRequest, recordUsageAndCharge } from '@/lib/server/billing';
import { runAgentExecution } from '@/lib/runtime/engine';
import { getUsdTomanRate } from '@/lib/server/fx';

const API = 'https://api.telegram.org';

function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

export type TelegramProfileSyncResult = {
  ok: boolean;
  failures: Array<{ method: string; message: string }>;
};

export async function configureBotProfile(
  token: string,
  botName: string,
  profile?: { shortDescription?: string; description?: string; commands?: Array<{command:string;description:string}> },
): Promise<TelegramProfileSyncResult> {
  const safeName = botName.trim().slice(0, 32);
  const commands = profile?.commands?.length
    ? profile.commands
    : [
        { command: 'start', description: 'شروع' },
        { command: 'newchat', description: 'گفتگوی جدید' },
        { command: 'help', description: 'راهنما' },
        { command: 'usage', description: 'مصرف' },
      ];

  const operations: Array<[string, Promise<unknown>]> = [
    ['setMyName', telegramCall(token, 'setMyName', { name: safeName })],
    ['setMyShortDescription', telegramCall(token, 'setMyShortDescription', {
      short_description: (profile?.shortDescription || 'دستیار هوشمند Cortex برای پاسخ‌گویی و مدیریت دانش.').slice(0, 120),
    })],
    ['setMyDescription', telegramCall(token, 'setMyDescription', {
      description: (profile?.description || 'دستیار هوشمند Cortex؛ متصل به دانش و ایجنت اختصاصی شما.').slice(0, 512),
    })],
    ['setMyCommands', telegramCall(token, 'setMyCommands', { commands })],
    ['setChatMenuButton', telegramCall(token, 'setChatMenuButton', { menu_button: { type: 'commands' } })],
  ];

  const settled = await Promise.allSettled(operations.map(([, promise]) => promise));
  const failures = settled.flatMap((result, index) =>
    result.status === 'rejected'
      ? [{ method: operations[index][0], message: result.reason instanceof Error ? result.reason.message : String(result.reason) }]
      : [],
  );

  return { ok: failures.length === 0, failures };
}

export async function setWebhook(token: string, url: string, secret: string) {
  return telegramCall(token, 'setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
  });
}

export async function getWebhookInfo(token: string) {
  return telegramCall(token, 'getWebhookInfo', {});
}

export async function verifyWebhook(token: string, expectedUrl: string) {
  const info = await getWebhookInfo(token) as { url?: string; pending_update_count?: number; last_error_message?: string | null } | null;
  const actualUrl = typeof info?.url === 'string' ? info.url : '';
  if (actualUrl !== expectedUrl) {
    throw new Error('Webhook تلگرام تأیید نشد. آدرس ثبت‌شده با آدرس Cortex یکسان نیست.');
  }
  return info;
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

async function editMessageText(token: string, chatId: string | number, messageId: string | number, text: string, options: SendOptions = {}) {
  return telegramCall(token, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: text.slice(0, 4096),
    disable_web_page_preview: true,
    ...options,
  });
}

async function sendPhoto(token: string, chatId: string | number, photo: string, caption: string, replyMarkup?: Record<string, unknown>) {
  return telegramCall(token, 'sendPhoto', {
    chat_id: chatId,
    photo,
    caption: caption.slice(0, 1024),
    parse_mode: 'HTML',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function requestContact(token: string, chatId: string | number) {
  return sendMessage(
    token,
    chatId,
    '<b>🔐 یک مرحله امنیتی</b>\n\nبرای شناسایی و فعال‌سازی حساب، شماره موبایل خودتان را با دکمه زیر ارسال کنید.\n\nاگر شماره شما قبلاً در پنل مدیر مجاز شده باشد، دسترسی همان لحظه فعال می‌شود؛ در غیر این صورت حساب شما در انتظار تأیید می‌ماند.',
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

function buttonMarkup(profile: Awaited<ReturnType<typeof getTelegramBotProfile>>) {
  const reserved = new Set(["start", "newchat", "help", "usage"]);
  const custom = profile.commands
    .filter((item) => !reserved.has(item.command))
    .slice(0, 8)
    .map((item) => ({ text: "◻️ " + item.description.slice(0, 42), callback_data: "cmd:" + item.command }));
  const rows: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: profile.newChatButtonText, callback_data: "new_chat" }, { text: profile.helpButtonText, callback_data: "help" }],
  ];
  if (profile.usageButtonText) rows.push([{ text: profile.usageButtonText, callback_data: "usage" }]);
  for (let i = 0; i < custom.length; i += 2) rows.push(custom.slice(i, i + 2));
  return { inline_keyboard: rows };
}

function pickThinkingMessage(profile: Awaited<ReturnType<typeof getTelegramBotProfile>>, index = 0) {
  return profile.thinkingMessages[index % Math.max(1, profile.thinkingMessages.length)] || '🧠 در حال فکر کردن…';
}

async function sendWelcome(token: string, chatId: string | number, profile: Awaited<ReturnType<typeof getTelegramBotProfile>>) {
  const markup = buttonMarkup(profile);
  if (profile.showWelcomeBanner && profile.welcomeBannerUrl) {
    try {
      await sendPhoto(token, chatId, profile.welcomeBannerUrl, '<b>' + escapeTelegramHtml(profile.welcomeTitle) + '</b>\n\n' + escapeTelegramHtml(profile.welcomeText), markup);
      return;
    } catch {}
  }
  return sendMessage(token, chatId, '<b>' + escapeTelegramHtml(profile.welcomeTitle) + '</b>\n\n' + escapeTelegramHtml(profile.welcomeText), {
    parse_mode: 'HTML',
    reply_markup: markup,
  });
}

async function sendHelp(token: string, chatId: string | number, profile: Awaited<ReturnType<typeof getTelegramBotProfile>>) {
  return sendMessage(token, chatId, '<b>راهنمای دستیار</b>\n\n' + escapeTelegramHtml(profile.helpText), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: profile.newChatButtonText, callback_data: 'new_chat' },
        { text: profile.usageButtonText, callback_data: 'usage' },
      ]],
    },
  });
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
  const used = Number(value).toLocaleString("fa-IR");
  return limit > 0
    ? used + " / " + Number(limit).toLocaleString("fa-IR") + " توکن"
    : used + " توکن";
}

function formatTomanMicros(value: number, usdToman: number) {
  return Math.round((Math.max(0, value) / 1_000_000) * usdToman).toLocaleString('fa-IR') + ' تومان';
}

async function sendAccessRequired(token: string, chatId: string | number, profile: Awaited<ReturnType<typeof getTelegramBotProfile>>) {
  return requestContact(token, chatId).catch(async () =>
    sendMessage(token, chatId, '<b>🔐 تأیید شماره موبایل</b>\n\n' + escapeTelegramHtml(profile.accessRequiredText), { parse_mode: 'HTML' }),
  );
}

async function sendUsage(token: string, chatId: string | number, telegramUserId: string) {
  const user = await db.telegramUser.findUnique({ where: { id: telegramUserId } });
  if (!user) return;

  const [daily, monthly, fx] = await Promise.all([
    db.usageEvent.aggregate({
      where: { telegramUserId: user.id, createdAt: { gte: startOfDay() } },
      _sum: { totalTokens: true, estimatedCostMicros: true },
      _count: { _all: true },
    }),
    db.usageEvent.aggregate({
      where: { telegramUserId: user.id, createdAt: { gte: startOfMonth() } },
      _sum: { totalTokens: true, estimatedCostMicros: true },
      _count: { _all: true },
    }),
    getUsdTomanRate(),
  ]);

  return sendMessage(
    token,
    chatId,
    '<b>📊 وضعیت مصرف</b>\n\n' +
      'امروز: <b>' + formatUsage(daily._sum.totalTokens ?? 0, user.dailyTokenLimit) + '</b>\n' +
      'این ماه: <b>' + formatUsage(monthly._sum.totalTokens ?? 0, user.monthlyTokenLimit) + '</b>\n' +
      'هزینه امروز: <b>' + formatTomanMicros(daily._sum.estimatedCostMicros ?? 0, fx.usdToman) + '</b>\n' +
      'هزینه این ماه: <b>' + formatTomanMicros(monthly._sum.estimatedCostMicros ?? 0, fx.usdToman) + '</b>\n\n' +
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

  const token = decryptSecret(bot.tokenEncrypted);
  const profile = await getTelegramBotProfile(bot.id);
  const callback = update?.callback_query;

  if (callback) {
    const tgId = String(callback.from?.id ?? '');
    const chatId = callback.message?.chat?.id;
    if (!tgId || chatId == null) return;

    const user = await db.telegramUser.findUnique({
      where: { botId_telegramUserId: { botId, telegramUserId: tgId } },
    });
    await answerCallback(token, String(callback.id)).catch(() => undefined);

    if (!user) {
      await sendAccessRequired(token, chatId, profile);
      return;
    }
    if (user.status === 'blocked') {
      await sendMessage(token, chatId, profile.blockedText);
      return;
    }
    if (user.status !== 'allowed') {
      await sendAccessRequired(token, chatId, profile);
      return;
    }

    const data = String(callback.data ?? '');
    if (data === 'help') {
      await sendHelp(token, chatId, profile);
    } else if (data === 'usage') {
      await sendUsage(token, chatId, user.id);
    } else if (data === 'new_chat') {
      await createTelegramConversation(bot.id, bot.agentId, tgId);
      await sendMessage(token, chatId, profile.newChatText, {
        reply_markup: buttonMarkup(profile),
      });
    } else if (data.startsWith("cmd:")) {
      const command = data.slice(4).replace(/[^a-z0-9_]/gi, "").slice(0, 32);
      const configured = profile.commands.some((item) => item.command === command);
      if (configured) {
        await processTelegramUpdate(botId, {
          message: { chat: { id: chatId }, from: callback.from, text: "/" + command },
        });
      }
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

  const startToken = typeof msg.text === 'string' ? parseTelegramStartToken(msg.text) : null;
  if (startToken && user.status !== 'blocked') {
    const invite = await db.telegramAllowlistEntry.findUnique({ where: { inviteTokenHash: hashTelegramInviteToken(startToken) } });
    if (invite && invite.botId === bot.id && invite.status === 'allowed') {
      const claimed = invite.claimedTelegramUserId;
      if (!claimed || claimed === tgId) {
        const claimResult = await db.telegramAllowlistEntry.updateMany({
          where: {
            id: invite.id,
            botId: bot.id,
            status: 'allowed',
            inviteTokenHash: hashTelegramInviteToken(startToken),
            OR: [{ claimedTelegramUserId: null }, { claimedTelegramUserId: tgId }],
          },
          data: { claimedTelegramUserId: tgId, claimedAt: new Date(), inviteTokenHash: null },
        });
        if (claimResult.count === 1) {
          await db.telegramUser.update({
            where: { id: user.id },
            data: {
              phoneNumber: invite.phoneNumber,
              status: 'allowed',
              dailyMessageLimit: invite.dailyMessageLimit,
              monthlyMessageLimit: invite.monthlyMessageLimit,
              dailyTokenLimit: invite.dailyTokenLimit,
              monthlyTokenLimit: invite.monthlyTokenLimit,
            },
          });
          user.status = 'allowed';
          user.phoneNumber = invite.phoneNumber;
          user.dailyMessageLimit = invite.dailyMessageLimit;
          user.monthlyMessageLimit = invite.monthlyMessageLimit;
          user.dailyTokenLimit = invite.dailyTokenLimit;
          user.monthlyTokenLimit = invite.monthlyTokenLimit;
          await sendWelcome(token, msg.chat.id, profile);
          return;
        }
      }
    }
  }

  const contactPhone = msg.contact?.phone_number ? normalizeTelegramPhone(msg.contact.phone_number) : '';
  let contactActivated = false;
  if (contactPhone && msg.contact?.user_id != null && String(msg.contact.user_id) === tgId && user.status !== 'blocked') {
    const invite = await db.telegramAllowlistEntry.findUnique({
      where: { botId_phoneNumber: { botId: bot.id, phoneNumber: contactPhone } },
    });

    if (invite?.status === 'blocked') {
      await db.telegramUser.update({
        where: { id: user.id },
        data: { phoneNumber: contactPhone, status: 'blocked' },
      });
      user.phoneNumber = contactPhone;
      user.status = 'blocked';
    } else if (invite?.status === 'allowed' && (!invite.claimedTelegramUserId || invite.claimedTelegramUserId === tgId)) {
      await db.$transaction([
        db.telegramAllowlistEntry.update({
          where: { id: invite.id },
          data: { claimedTelegramUserId: tgId, claimedAt: new Date(), inviteTokenHash: null },
        }),
        db.telegramUser.update({
          where: { id: user.id },
          data: {
            phoneNumber: contactPhone,
            status: 'allowed',
            dailyMessageLimit: invite.dailyMessageLimit,
            monthlyMessageLimit: invite.monthlyMessageLimit,
            dailyTokenLimit: invite.dailyTokenLimit,
            monthlyTokenLimit: invite.monthlyTokenLimit,
          },
        }),
      ]);
      user.status = 'allowed';
      user.phoneNumber = contactPhone;
      user.dailyMessageLimit = invite.dailyMessageLimit;
      user.monthlyMessageLimit = invite.monthlyMessageLimit;
      user.dailyTokenLimit = invite.dailyTokenLimit;
      user.monthlyTokenLimit = invite.monthlyTokenLimit;
      contactActivated = true;
    } else {
      // Contact sharing alone never grants access. The owner-managed allowlist is
      // the source of truth; unknown numbers stay pending until approved/invited.
      await db.telegramUser.update({
        where: { id: user.id },
        data: { phoneNumber: contactPhone, status: 'pending' },
      });
      user.phoneNumber = contactPhone;
      user.status = 'pending';
    }
  }

  if (user.status === 'blocked') {
    await sendMessage(token, msg.chat.id, profile.blockedText);
    return;
  }
  if (user.status !== 'allowed') {
    await sendAccessRequired(token, msg.chat.id, profile);
    return;
  }

  if (contactActivated) {
    await sendWelcome(token, msg.chat.id, profile);
    return;
  }

  const rawText = typeof msg.text === 'string' ? msg.text.trim() : '';
  const command = rawText.split(/\s+/)[0]?.split('@')[0]?.toLowerCase();
  const normalizedQuickAction = rawText.toLowerCase();

  if (command === '/start' || command === '/newchat' || command === '/help' || command === '/usage') {
    if (command === '/help') return sendHelp(token, msg.chat.id, profile);
    if (command === '/usage') return sendUsage(token, msg.chat.id, user.id);
    if (command === '/start') return sendWelcome(token, msg.chat.id, profile);

    await createTelegramConversation(bot.id, bot.agentId, tgId);
    await sendMessage(token, msg.chat.id, profile.newChatText, { reply_markup: buttonMarkup(profile) });
    return;
  }

  if (!rawText) return;

  const quickActions = new Set([
    profile.newChatButtonText.toLowerCase(),
    profile.usageButtonText.toLowerCase(),
    profile.helpButtonText.toLowerCase(),
    '💬 گفتگوی جدید',
    '📊 مصرف من',
    '❓ راهنما',
  ]);
  if (quickActions.has(normalizedQuickAction)) {
    if (normalizedQuickAction === profile.usageButtonText.toLowerCase() || normalizedQuickAction === '📊 مصرف من') {
      return sendUsage(token, msg.chat.id, user.id);
    }
    if (normalizedQuickAction === profile.helpButtonText.toLowerCase() || normalizedQuickAction === '❓ راهنما') {
      return sendHelp(token, msg.chat.id, profile);
    }
    await createTelegramConversation(bot.id, bot.agentId, tgId);
    await sendMessage(token, msg.chat.id, profile.newChatText, { reply_markup: buttonMarkup(profile) });
    return;
  }

  await sendChatAction(token, msg.chat.id, 'typing').catch(() => undefined);

  let reservationId: string | null = null;
  let billingReservationId: string | null = null;
  let progressMessageId: string | number | null = null;
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

    reservationId = await reserveUsageWithinLimits(
      bot.workspaceId,
      1,
      estimatedPromptTokens + RAG_QUERY_EXPANSION_RESERVE_TOKENS,
      botAgent.maxTokens,
      user.id,
    );

    billingReservationId = (await reserveBillingForAgentRequest({
      workspaceId: bot.workspaceId,
      agentId: botAgent.id,
      inputTokens: estimatedPromptTokens + RAG_QUERY_EXPANSION_RESERVE_TOKENS,
      maxOutputTokens: botAgent.maxTokens,
    })).reservationId;

    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: rawText,
      },
    });

    const generationStartedAt = Date.now();
    const progress = async (message: string) => {
      if (!profile.showThinking) return;
      if (progressMessageId == null) {
        const sent = await sendMessage(token, msg.chat.id, message, { parse_mode: 'HTML' }).catch(() => null) as any;
        progressMessageId = sent?.message_id ?? null;
      } else {
        await editMessageText(token, msg.chat.id, progressMessageId, message, { parse_mode: 'HTML' }).catch(() => undefined);
      }
    };

    if (profile.showThinking) {
      const thinking = pickThinkingMessage(profile, 0);
      const sent = await sendMessage(token, msg.chat.id, thinking).catch(() => null) as any;
      progressMessageId = sent?.message_id ?? null;
    }

    let content = '';
    let provider = 'unknown';
    let model = 'unknown';
    let retrieval: any[] = [];
    let auxiliaryInputTokens = 0;
    let auxiliaryOutputTokens = 0;

    await progress(pickThinkingMessage(profile, 1));

    const result = await runAgentExecution({
      agentId: bot.agentId,
      workspaceId: bot.workspaceId,
      conversationId: conversation.id,
      memorySubjectKey: 'telegram:' + bot.id + ':' + tgId,
      input: rawText,
      history: promptHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      onProgress: progress,
    });

    content = result.content;
    provider = result.provider;
    model = result.model ?? 'unknown';
    retrieval = result.retrieval ?? [];
    auxiliaryInputTokens = result.auxiliaryInputTokens ?? 0;
    auxiliaryOutputTokens = result.auxiliaryOutputTokens ?? 0;

    await progress(pickThinkingMessage(profile, 2));

    const metadata = {
      sources: toSourceRefs(retrieval),
      retrieval: toRetrievalDebug(retrieval),
      provider,
      model,
      latencyMs: Date.now() - generationStartedAt,
      conversationId: conversation.id,
    };

    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content,
        metadata: JSON.stringify(metadata),
      },
    });

    await db.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    const inputTokens = estimatedPromptTokens + auxiliaryInputTokens;
    const outputTokens = estimateTokens(content) + auxiliaryOutputTokens;

    await recordUsageAndCharge({
      usage: {
        workspaceId: bot.workspaceId,
        agentId: bot.agentId,
        telegramBotId: bot.id,
        telegramUserId: user.id,
        channel: 'telegram',
        provider,
        model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      reservationId: billingReservationId,
    });
    billingReservationId = null;

    if (reservationId) {
      try {
        await db.usageReservation.delete({ where: { id: reservationId } });
      } catch {
        // Cleanup failure must not mask the original Telegram/runtime error.
      }
    }
    reservationId = null;

    await db.telegramBot.update({
      where: { id: bot.id },
      data: { status: 'connected', lastSeenAt: new Date(), lastError: null },
    });

    if (progressMessageId != null && content.length <= 4096) {
      await editMessageText(token, msg.chat.id, progressMessageId, content, {
        parse_mode: undefined,
        reply_markup: buttonMarkup(profile),
      });
    } else {
      await sendMessage(token, msg.chat.id, content, { reply_markup: buttonMarkup(profile) });
    }
  } catch (error) {
    await releaseUsageReservation(reservationId);
    await releaseBillingReservation(billingReservationId);
    reservationId = null;
    billingReservationId = null;

    if (error && typeof error === 'object' && 'status' in error && Number((error as { status?: unknown }).status) === 429) {
      const message = error instanceof Error ? error.message : 'سقف مصرف این کاربر پر شده است.';
      await sendMessage(token, msg.chat.id, '⏳ ' + message + '\n\nبرای ادامه، سقف مصرف باید توسط مدیر افزایش پیدا کند.').catch(() => undefined);
      return;
    }

    if (progressMessageId != null) {
      await editMessageText(token, msg.chat.id, progressMessageId, profile.errorText, {
        reply_markup: buttonMarkup(profile),
      }).catch(() => undefined);
    } else {
      await sendMessage(token, msg.chat.id, profile.errorText, {
        reply_markup: buttonMarkup(profile),
      }).catch(() => undefined);
    }

    console.error('[cortex][telegram] message processing failed:', error);

    await db.telegramBot.update({
      where: { id: bot.id },
      data: {
        status: 'error',
        lastError: error instanceof Error ? error.message.slice(0, 1000) : 'خطای ناشناخته',
      },
    }).catch(() => undefined);

    throw error;
  }
}

