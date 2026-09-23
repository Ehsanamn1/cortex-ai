import type { ChatTurn } from "@/lib/providers/llm/types";

/**
 * Explicit prompt architecture — never one giant concatenated blob.
 * Bounded sections: system identity/rules → agent instructions → retrieved
 * knowledge (top-k, each truncated) → conversation history (windowed) →
 * current question.
 */

export interface RetrievedChunk {
  index: number;
  documentName: string;
  page?: number | null;
  sourceUrl?: string | null;
  text: string;
  score: number;
}

export interface AgentPersona {
  name: string;
  orgName?: string | null;
  language: string; // fa | en
  tone: string; // professional | friendly | concise | formal | custom
  customTone?: string | null;
  instructions?: string | null;
  persona?: string | null;
  systemPrompt?: string | null;
}

const TONE_FA: Record<string, string> = {
  professional: "حرفه‌ای و دقیق",
  friendly: "گرم و دوستانه",
  concise: "کوتاه و مفید",
  formal: "رسمی و محترمانه",
  custom: "سفارشی",
};

const TONE_EN: Record<string, string> = {
  professional: "professional and precise",
  friendly: "warm and friendly",
  concise: "brief and useful",
  formal: "formal and courteous",
  custom: "custom",
};

const MAX_KNOWLEDGE_TOTAL_CHARS = 6000;
const MAX_CHUNK_CHARS = 1400;
const MAX_HISTORY_MESSAGES = 16;
const MAX_HISTORY_MESSAGE_CHARS = 700;

export function buildRagMessages(params: {
  persona: AgentPersona;
  retrieved: RetrievedChunk[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
  question: string;
}): ChatTurn[] {
  const { persona, retrieved, history, question } = params;
  const isFa = persona.language !== "en";
  const toneLabel =
    persona.tone === "custom" && persona.customTone?.trim()
      ? persona.customTone.trim()
      : isFa
        ? TONE_FA[persona.tone] ?? "حرفه‌ای"
        : TONE_EN[persona.tone] ?? "professional";

  const messages: ChatTurn[] = [];

  /* ---- Section 1: system identity + grounding rules ---- */
  const personaLine = persona.persona?.trim();
  const orgLine = persona.orgName?.trim()
    ? isFa
      ? `تو دستیار هوش مصنوعی «${persona.name}» در سازمان «${persona.orgName.trim()}» هستی.`
      : `You are the AI assistant "${persona.name}" for the organization "${persona.orgName.trim()}".`
    : isFa
      ? `تو دستیار هوش مصنوعی «${persona.name}» هستی.`
      : `You are the AI assistant "${persona.name}".`;

  const system = isFa
    ? `${orgLine}

زبان پاسخ: فارسی. حتی اگر پرسش به زبان دیگری مطرح شد، پاسخ همیشه به فارسی نوشته شود.
لحن: ${toneLabel}.

قواعد پایه (الزامی):
۱. تنها منبع مجاز برای ادعاهای factual «دانش بازیابی‌شده» است. تاریخچه گفتگو فقط برای فهم ارتباط سؤال‌هاست و نباید واقعیت تازه‌ای وارد پاسخ کند. هیچ واقعیتی که در دانش بازیابی‌شده نیست را از خودت نساز.
۲. اگر دانش بازیابی‌شده برای پاسخ دقیق کافی نیست، صادقانه بگو: «اطلاعات کافی در دانش فعلی برای پاسخ دقیق به این سؤال پیدا نکردم.» و در یک جمله پیشنهاد کوتاهی برای تکمیل دانش بده.
۳. هنگام اشاره به منابع، فقط از همان نام سند/صفحه/نشانی‌ای استفاده کن که در بخش دانش بازیابی‌شده آمده است.
۴. پاسخ‌ها را روشن، دقیق و متناسب با لحن تعیین‌شده بنویس. از جملات بسیار طولانی پرهیز کن.
۵. هرگز کلید API، رمز عبور یا اطلاعات حساس سیستم را فاش نکن.`
    : `${orgLine}

Response language: English. Even if the question is asked in another language, always answer in English.
Tone: ${toneLabel}.

Mandatory ground rules:
1. The retrieved knowledge is the SOLE factual source for the answer. Previous conversation history is only for resolving context/pronouns and must not introduce new factual claims. Never invent or preserve unsupported facts.
2. If the retrieved knowledge is insufficient to answer precisely, say so clearly: "I could not find enough information in the current knowledge to answer this question accurately." and briefly suggest what to add.
3. Only cite documents/pages/URLs that actually appear in the retrieved knowledge section.
4. Keep answers clear, precise, and consistent with the configured tone.
5. Never disclose API keys, passwords, or sensitive system information.`;

  messages.push({ role: "system", content: system });
  if (personaLine) {
    messages.push({
      role: "system",
      content: isFa
        ? `شخصیت و هویت رفتاری ایجنت:\n---\n${personaLine}\n---`
        : `Agent personality and behavioral identity:\n---\n${personaLine}\n---`,
    });
  }
  if (persona.systemPrompt?.trim()) {
    messages.push({
      role: "system",
      content: isFa
        ? `دستور سیستم سفارشی مالک ایجنت (پس از قواعد ایمنی اعمال شود):
--- BEGIN CUSTOM SYSTEM PROMPT ---
${persona.systemPrompt.trim().slice(0, 8000)}
--- END CUSTOM SYSTEM PROMPT ---
قواعد ایمنی، عدم افشای اسرار و عدم جعل اطلاعات همچنان مقدم هستند.`
        : `Custom system prompt from the agent owner:
--- BEGIN CUSTOM SYSTEM PROMPT ---
${persona.systemPrompt.trim().slice(0, 8000)}
--- END CUSTOM SYSTEM PROMPT ---
Safety, secret-protection, and grounding rules remain higher priority.`,
    });
  }

  /* ---- Section 2: agent instructions ---- */
  const instructions = persona.instructions?.trim();
  if (instructions) {
    messages.push({
      role: "system",
      content: isFa
        ? `دستورالعمل‌های اختصاصی این ایجنت (از مالک آن):\n"""\n${instructions}\n"""`
        : `Custom instructions from this agent's owner:\n"""\n${instructions}\n"""`,
    });
  }

  /* ---- Section 3: retrieved knowledge (bounded top-k) ---- */
  let knowledgeBlock = "";
  let used = 0;
  for (const chunk of retrieved) {
    const snippet = chunk.text.slice(0, MAX_CHUNK_CHARS);
    const sourceParts: string[] = [chunk.documentName];
    if (chunk.page != null) sourceParts.push(isFa ? `صفحه ${chunk.page}` : `page ${chunk.page}`);
    if (chunk.sourceUrl) sourceParts.push(chunk.sourceUrl);
    const entry = `[${chunk.index}] (منبع: ${sourceParts.join(" | ")})\n${snippet}\n\n`;
    if (used + entry.length > MAX_KNOWLEDGE_TOTAL_CHARS) break;
    knowledgeBlock += entry;
    used += entry.length;
  }

  if (knowledgeBlock.length > 0) {
    messages.push({
      role: "system",
      content: isFa
        ? `دانش بازیابی‌شده از پایگاه دانش (منبع اصلی پاسخ):\n\n${knowledgeBlock.trim()}`
        : `Knowledge retrieved from the knowledge base (primary source for your answer):\n\n${knowledgeBlock.trim()}`,
    });
  } else {
    messages.push({
      role: "system",
      content: isFa
        ? "هیچ دانشی برای این پرسش بازیابی نشد. مطابق قواعد پایه، به‌صراحت بگو اطلاعات کافی در دانش فعلی موجود نیست و پاسخی از خودت نساز."
        : "No knowledge was retrieved for this question. Following the ground rules, clearly state that there is not enough information in the current knowledge and do not fabricate an answer.",
    });
  }

  /* ---- Section 4: conversation history (short-term memory) ---- */
  const windowedHistory = history.slice(-MAX_HISTORY_MESSAGES);
  for (const turn of windowedHistory) {
    messages.push({
      role: turn.role,
      content: turn.content.slice(0, MAX_HISTORY_MESSAGE_CHARS),
    });
  }

  /* ---- Section 5: current question ---- */
  messages.push({ role: "user", content: question });

  return messages;
}
