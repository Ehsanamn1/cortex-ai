import crypto from "node:crypto";
import { db } from "@/lib/db";
import { llmManager } from "@/lib/providers/llm/manager";
import { getVectorStore, type UpsertPoint } from "@/lib/providers/vector";
import { embeddingManager } from "@/lib/providers/embeddings/manager";
import { chunkInputs } from "@/lib/knowledge/chunk";
import { estimateTokens } from "@/lib/server/audit";
import { estimateLlmCostMicros } from "@/lib/server/pricing";
import { deleteSourceCompletely } from "@/lib/knowledge/pipeline";

export interface OnboardingQuestion { id: string; category: string; question: string; }

export const BUSINESS_ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  { id: "business", category: "شناخت کسب‌وکار", question: "اسم کسب‌وکار شما چیست و دقیقاً چه کاری انجام می‌دهید؟" },
  { id: "offer", category: "شناخت کسب‌وکار", question: "محصولات یا خدمات اصلی شما دقیقاً چه چیزهایی هستند؟" },
  { id: "value", category: "پیشنهاد ارزش", question: "مشتری چرا باید شما را به جای گزینه‌های دیگر انتخاب کند؟" },
  { id: "customer", category: "مشتری", question: "مشتری اصلی شما چه کسی است؟" },
  { id: "segments", category: "مشتری", question: "چه گروه‌های دیگری از مشتری‌ها دارید و هر کدام چه نیاز متفاوتی دارند؟" },
  { id: "location", category: "جغرافیا", question: "در چه شهرها، مناطق یا کشورهایی خدمت می‌دهید؟" },
  { id: "hours", category: "عملیات", question: "ساعات کاری و روزهای فعالیت شما چگونه است؟" },
  { id: "channels", category: "ارتباط", question: "مشتری از چه راه‌هایی می‌تواند با شما تماس بگیرد؟" },
  { id: "order", category: "فروش", question: "فرآیند سفارش یا دریافت خدمات از ابتدا تا پایان چگونه است؟" },
  { id: "pricing", category: "قیمت‌گذاری", question: "مدل قیمت‌گذاری شما چگونه است؟ مبلغ ثابت، متغیر، اشتراک یا مذاکره‌ای؟" },
  { id: "ranges", category: "قیمت‌گذاری", question: "بازه قیمت محصولات یا خدمات مهم شما چقدر است؟" },
  { id: "payment", category: "پرداخت", question: "چه روش‌های پرداختی قبول می‌کنید و شرایط پرداخت چیست؟" },
  { id: "delivery", category: "تحویل", question: "تحویل، ارسال یا اجرای خدمت چطور انجام می‌شود و معمولاً چقدر زمان می‌برد؟" },
  { id: "refund", category: "قوانین", question: "قوانین مرجوعی، کنسلی یا استرداد وجه شما چیست؟" },
  { id: "warranty", category: "قوانین", question: "گارانتی، ضمانت یا پشتیبانی پس از فروش شما چگونه است؟" },
  { id: "faq", category: "پرسش‌های متداول", question: "۱۰ سؤال پرتکراری که مشتری‌ها معمولاً از شما می‌پرسند چیست؟" },
  { id: "objections", category: "اعتراض‌ها", question: "مشتری‌ها معمولاً چه نگرانی یا اعتراضی دارند و شما چطور پاسخ می‌دهید؟" },
  { id: "differentiators", category: "مزیت", question: "سه مزیت مشخص و قابل اثبات شما چیست؟" },
  { id: "competitors", category: "بازار", question: "مشتری معمولاً شما را با چه گزینه‌ها یا رقبایی مقایسه می‌کند؟" },
  { id: "promotions", category: "فروش", question: "تخفیف‌ها، کمپین‌ها یا شرایط ویژه فعلی شما چیست؟" },
  { id: "policies", category: "قوانین", question: "چه قوانین یا محدودیت‌هایی وجود دارد که ایجنت باید همیشه رعایت کند؟" },
  { id: "forbidden", category: "ایمنی کسب‌وکار", question: "ایجنت تحت هیچ شرایطی درباره چه چیزهایی نباید قول یا ادعای قطعی کند؟" },
  { id: "escalation", category: "ارجاع", question: "در چه شرایطی باید گفتگو به نیروی انسانی ارجاع شود؟" },
  { id: "human", category: "ارجاع", question: "برای ارجاع به انسان چه نام، شماره، آیدی یا مسیر ارتباطی استفاده شود؟" },
  { id: "tone", category: "هویت", question: "لحن مطلوب برند شما چیست؟ رسمی، صمیمی، کوتاه، تخصصی یا ترکیبی؟ چند مثال بزنید." },
  { id: "complaints", category: "پشتیبانی", question: "در برخورد با مشتری ناراضی یا شکایت، چه روندی را می‌خواهید ایجنت رعایت کند؟" },
  { id: "lead", category: "فروش", question: "برای تشخیص مشتری بالقوه چه اطلاعاتی باید از او پرسیده شود؟" },
  { id: "qualification", category: "فروش", question: "چه شرایطی باعث می‌شود یک سرنخ برای تیم فروش ارزشمندتر باشد؟" },
  { id: "seasonal", category: "اطلاعات متغیر", question: "چه اطلاعات فصلی، مناسبتی یا موقتی باید در پاسخ‌ها در نظر گرفته شود؟" },
  { id: "critical", category: "اطلاعات تکمیلی", question: "چه نکته مهم دیگری هست که اگر ایجنت آن را نداند ممکن است به مشتری پاسخ اشتباه بدهد؟" },
];

export interface OnboardingResult {
  businessSummary: string;
  services: string[];
  targetAudience: string[];
  valueProposition: string[];
  productsAndPricing: string[];
  policies: string[];
  operatingHours: string;
  contactChannels: string[];
  faq: Array<{ question: string; answer: string }>;
  salesRules: string[];
  escalationRules: string[];
  forbiddenClaims: string[];
  tone: string;
  additionalFacts: string[];
  instructions: string;
}

export function parseOnboardingResult(raw: string): OnboardingResult {
  const match = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!match) throw new Error("پاسخ ساخت دانش به قالب JSON معتبر تبدیل نشد.");
  let parsed: unknown;
  try { parsed = JSON.parse(match); } catch { throw new Error("پاسخ ساخت دانش JSON معتبر نیست."); }
  if (!parsed || typeof parsed !== "object") throw new Error("خروجی ساخت دانش معتبر نیست.");
  const data = parsed as Record<string, unknown>;
  const str = (v: unknown) => typeof v === "string" ? v.trim() : "";
  const arr = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map(x => x.trim()).filter(Boolean).slice(0, 40) : [];
  const faq = Array.isArray(data.faq) ? data.faq.filter((x): x is Record<string, unknown> => !!x && typeof x === "object").map(x => ({ question: str(x.question), answer: str(x.answer) })).filter(x => x.question && x.answer).slice(0, 30) : [];
  const result: OnboardingResult = {
    businessSummary: str(data.businessSummary), services: arr(data.services), targetAudience: arr(data.targetAudience),
    valueProposition: arr(data.valueProposition), productsAndPricing: arr(data.productsAndPricing), policies: arr(data.policies),
    operatingHours: str(data.operatingHours), contactChannels: arr(data.contactChannels), faq, salesRules: arr(data.salesRules),
    escalationRules: arr(data.escalationRules), forbiddenClaims: arr(data.forbiddenClaims), tone: str(data.tone),
    additionalFacts: arr(data.additionalFacts), instructions: str(data.instructions),
  };
  if (!result.businessSummary && !result.services.length) throw new Error("خروجی ساخت دانش اطلاعات کافی ندارد.");
  return result;
}

function buildKnowledgeText(result: OnboardingResult, answers: Array<{ question: OnboardingQuestion; answer: string }>): string {
  const section = (title: string, value: string | string[]) => {
    if (Array.isArray(value)) return value.length ? "## " + title + "\n- " + value.join("\n- ") : "";
    return value ? "## " + title + "\n" + value : "";
  };
  const faq = result.faq.map(x => x.question + "\nپاسخ: " + x.answer);
  const rawOwnerAnswers = answers.map((item, index) => (index + 1) + ". " + item.question.question + "\nپاسخ مالک: " + item.answer).join("\n\n");
  return [
    section("خلاصه کسب‌وکار", result.businessSummary), section("محصولات و خدمات", result.services),
    section("مخاطبان", result.targetAudience), section("پیشنهاد ارزش", result.valueProposition),
    section("محصول و قیمت", result.productsAndPricing), section("ساعات فعالیت", result.operatingHours),
    section("راه‌های ارتباطی", result.contactChannels), section("قوانین و سیاست‌ها", result.policies),
    section("پرسش‌های متداول", faq), section("قواعد فروش", result.salesRules), section("قواعد ارجاع", result.escalationRules),
    section("موارد ممنوع از ادعا", result.forbiddenClaims), section("لحن برند", result.tone), section("اطلاعات تکمیلی", result.additionalFacts),
    rawOwnerAnswers ? "## پاسخ‌های مستقیم مالک\n" + rawOwnerAnswers : "",
  ].filter(Boolean).join("\n\n");
}

async function indexBusinessKnowledge(
  agentId: string,
  workspaceId: string,
  result: OnboardingResult,
  answers: Array<{ question: OnboardingQuestion; answer: string }>,
): Promise<string> {
  const previous = await db.knowledgeSource.findFirst({ where: { agentId, type: "business_interview" }, select: { id: true } });
  if (previous) await deleteSourceCompletely(previous.id);
  const source = await db.knowledgeSource.create({ data: { agentId, name: "دانش مصاحبه کسب‌وکار", type: "business_interview", status: "processing" } });
  try {
    const document = await db.knowledgeDocument.create({ data: { sourceId: source.id, name: "پروفایل کسب‌وکار و قواعد پاسخ‌گویی", mimeType: "text/plain", status: "processing" } });
    const chunks = chunkInputs([{ text: buildKnowledgeText(result, answers), page: 1, section: "business-profile" }]);
    const embedder = embeddingManager.resolve();
    if (!embedder) throw new Error("سرویس Embedding برای ساخت دانش فعال نیست.");
    const vectors = await embedder.embedDocuments(chunks.map(x => x.text));
    const points: UpsertPoint[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const created = await db.knowledgeChunk.create({ data: { id: crypto.randomUUID(), documentId: document.id, sourceId: source.id, agentId, workspaceId, seq: i, text: chunk.text, page: chunk.page ?? 1, section: chunk.section, sourceUrl: null, metadata: JSON.stringify({ source: "business_interview" }) } });
      points.push({ id: created.id, vector: vectors[i]!, payload: { chunkId: created.id, text: chunk.text, documentName: document.name, page: chunk.page ?? 1, section: chunk.section ?? "business-profile", sourceUrl: null, seq: i, sourceId: source.id, documentId: document.id, workspaceId } });
    }
    await getVectorStore().upsertPoints(agentId, workspaceId, points);
    await db.knowledgeDocument.update({ where: { id: document.id }, data: { status: "ready" } });
    await db.knowledgeSource.update({ where: { id: source.id }, data: { status: "ready", error: null } });
    return source.id;
  } catch (error) {
    await db.knowledgeSource.update({ where: { id: source.id }, data: { status: "failed", error: error instanceof Error ? error.message.slice(0, 1000) : "خطای ساخت دانش" } }).catch(() => undefined);
    throw error;
  }
}

function buildSynthesisPrompt(answers: Array<{ question: OnboardingQuestion; answer: string }>): string {
  const transcript = answers.map((item, i) => (i + 1) + ". " + item.question.question + "\nپاسخ مالک: " + item.answer).join("\n\n");
  return "تو مسئول ساخت دانش اولیه یک کسب‌وکار برای Cortex هستی.\nفقط از پاسخ‌های مالک استفاده کن. هیچ قیمت، قانون، ویژگی، آدرس یا واقعیت جدیدی اختراع نکن.\nاگر چیزی گفته نشده، آن را خالی بگذار یا بنویس «نامشخص».\nخروجی فقط JSON معتبر باشد و کلیدهای businessSummary, services, targetAudience, valueProposition, productsAndPricing, policies, operatingHours, contactChannels, faq, salesRules, escalationRules, forbiddenClaims, tone, additionalFacts, instructions را داشته باشد.\n\nپاسخ‌ها:\n" + transcript;
}

export async function synthesizeOnboarding(answers: Array<{ question: OnboardingQuestion; answer: string }>, agentId: string, workspaceId: string): Promise<{ result: OnboardingResult; knowledgeSourceId: string }> {
  const resolved = await llmManager.resolveForAgent(agentId, workspaceId);
  if (!resolved.provider) throw Object.assign(new Error("سرویس هوش مصنوعی این ایجنت هنوز پیکربندی نشده است."), { status: 503 });
  const synthesisPrompt = buildSynthesisPrompt(answers);
  const completion = await resolved.provider.generateResponse({ messages: [{ role: "system", content: "پاسخ را فقط به صورت JSON معتبر بده و از اطلاعات خارج از مصاحبه استفاده نکن." }, { role: "user", content: synthesisPrompt }], temperature: 0, maxTokens: 2200 });
  const result = parseOnboardingResult(completion.content);
  const inputTokens = estimateTokens(synthesisPrompt);
  const outputTokens = estimateTokens(completion.content);
  await db.usageEvent.create({
    data: {
      workspaceId,
      agentId,
      channel: "onboarding",
      provider: completion.provider,
      model: completion.model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCostMicros: estimateLlmCostMicros(inputTokens, outputTokens, completion.provider, completion.model),
    },
  });
  const knowledgeSourceId = await indexBusinessKnowledge(agentId, workspaceId, result, answers);
  await db.agent.update({ where: { id: agentId }, data: { description: result.businessSummary.slice(0, 4000), persona: result.tone.slice(0, 2000) || null, instructions: result.instructions.slice(0, 8000) || null } });
  return { result, knowledgeSourceId };
}
