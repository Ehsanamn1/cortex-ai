"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  ChevronDown,
  Gauge,
  Layers3,
  MessageSquare,
  Orbit,
  Sparkles,
  WalletCards,
  Zap,
} from "lucide-react";
import { faNum } from "@/components/cortex/format";
import { api } from "@/lib/cortex-client";

type EstimatorModel = {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  qualityTier: string;
  speedTier: string;
  creditMultiplierBps: number;
  enabledForPlan: boolean;
};

type Plan = {
  id: string;
  key: string;
  name: string;
  priceToman: number;
  monthlyCredits: number;
};

type FxDto = { usdToman: number; source: string; asOf: string; stale: boolean };
type Props = {
  models: EstimatorModel[];
  monthlyCredits: number;
  overageCreditPriceToman: number;
  plans?: Plan[];
  pricingVerifiedAt?: string;
};

type Complexity = {
  key: "simple" | "standard" | "agentic";
  label: string;
  multiplier: number;
  description: string;
};

const COMPLEXITIES: Complexity[] = [
  { key: "simple", label: "ساده", multiplier: 1.2, description: "پاسخ کوتاه، FAQ و پردازش مستقیم" },
  { key: "standard", label: "استاندارد", multiplier: 2.2, description: "منطق چندمرحله‌ای و RAG معمولی" },
  { key: "agentic", label: "Agentic", multiplier: 4, description: "ابزار، RAG، چندمرحله‌ای و تکرار" },
];

const PRESETS = [
  { key: "support", label: "پشتیبانی", input: 1200, output: 600, messages: 1000, tasks: 0, complexity: "standard" as const },
  { key: "sales", label: "فروش و CRM", input: 1800, output: 900, messages: 800, tasks: 50, complexity: "standard" as const },
  { key: "agentic", label: "اتوماسیون Agentic", input: 2500, output: 1500, messages: 300, tasks: 100, complexity: "agentic" as const },
];

function parseInteger(value: string): number {
  if (!value.trim()) return 0;
  const normalized = value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٬,\s]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function moneyUsd(value: number): string {
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
}

function formatTomanCompact(value: number): string {
  const amount = Math.max(0, Math.round(value));
  if (amount >= 1_000_000_000) return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(amount / 1_000_000_000)} میلیارد تومان`;
  if (amount >= 1_000_000) return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(amount / 1_000_000)} میلیون تومان`;
  if (amount >= 1_000) return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(amount / 1_000)} هزار تومان`;
  return `${faNum(amount)} تومان`;
}

function formatTomanExact(value: number): string {
  return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)))} تومان`;
}

function describeModel(model: EstimatorModel): string {
  const id = model.modelId.toLowerCase();
  if (id.includes("gpt-6-astra")) return "مدل پرچم‌دار برای سخت‌ترین کارهای end-to-end، استدلال، کدنویسی، تحقیق و کار با ابزار.";
  if (id.includes("gpt-6-sol")) return "مدل قدرتمند برای استدلال و اتوماسیون روزمره با توازن کیفیت و هزینه.";
  if (id.includes("gpt-6-luna")) return "گزینه سریع و اقتصادی برای حجم بالا، پاسخ‌گویی و اتوماسیون سبک.";
  if (id.includes("gpt-5.6-cyber")) return "مدل تخصصی برای سناریوهای امنیت، تحلیل تهدید و کارهای فنی سنگین.";
  if (id.includes("gpt-5.6-terra")) return "مدل میانی برای استدلال، کدنویسی و اجرای گردش‌کارهای دقیق.";
  if (id.includes("gpt-5.6")) return "عضو خانواده GPT-5.6 برای کارهای متنی و Agentic با تعادل سرعت، کیفیت و هزینه.";
  if (id.includes("claude-opus")) return "برای تحلیل عمیق، خروجی طولانی و سناریوهایی که کیفیت استدلال اولویت دارد.";
  if (id.includes("claude-sonnet")) return "گزینه متعادل برای تحلیل، تولید محتوا، کدنویسی و Agentهای کسب‌وکار.";
  if (id.includes("claude-haiku")) return "مدل سریع برای پاسخ‌های پرتعداد و کارهای کم‌هزینه.";
  if (id.includes("gemini-3.1-pro")) return "برای مسائل پیچیده، استدلال چندمرحله‌ای و کارهای چندرسانه‌ای سطح بالا.";
  if (id.includes("gemini-3.7-flash")) return "مدل Flash سریع برای Agentic، کدنویسی و پردازش روزمره.";
  if (id.includes("gemini-3.1-flash-lite")) return "اقتصادی و مناسب حجم بالا، ترجمه و پردازش ساده.";
  if (id.includes("gemini-3-flash")) return "Flash سریع برای پاسخ‌گویی و سناریوهای عمومی با حجم بالا.";
  if (id.includes("gemini-2.5-pro")) return "برای کدنویسی و استدلال پیچیده.";
  if (id.includes("gemini-2.5-flash")) return "مدل سریع و چندرسانه‌ای برای کاربردهای عمومی.";
  if (id.includes("deepseek-v4-pro")) return "مدل قدرتمند DeepSeek برای استدلال، کدنویسی و کارهای طولانی.";
  if (id.includes("deepseek-flash")) return "گزینه کم‌هزینه و سریع برای حجم بالا و کارهای تکراری.";
  return model.qualityTier === "deep"
    ? "برای کارهای سنگین و چندمرحله‌ای با اولویت کیفیت."
    : model.qualityTier === "premium"
      ? "تعادل کیفیت و هزینه برای سناریوهای حرفه‌ای."
      : "مناسب پاسخ‌گویی سریع و مصرف اقتصادی.";
}

function TokenField({
  label,
  icon,
  value,
  setValue,
  placeholder,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  setValue: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="rounded-2xl border border-border/60 bg-background/55 p-3">
      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">{icon}{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9۰-۹]*"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="mt-2 w-full bg-transparent text-lg font-black outline-none placeholder:text-muted-foreground/35"
      />
    </label>
  );
}

export function BillingEstimator({ models, monthlyCredits, plans = [], overageCreditPriceToman, pricingVerifiedAt }: Props) {
  const available = models.filter((m) => m.enabledForPlan);
  const preferred = available.find((m) => m.modelId.toLowerCase().includes("gpt-6-astra"))
    ?? available[0]
    ?? models[0];

  const [modelId, setModelId] = useState(preferred?.id ?? "");
  const [input, setInput] = useState("4,000");
  const [output, setOutput] = useState("1,200");
  const [messages, setMessages] = useState("100");
  const [tasks, setTasks] = useState("10");
  const [complexityKey, setComplexityKey] = useState<Complexity["key"]>("standard");

  useEffect(() => {
    if (!models.some((model) => model.id === modelId)) setModelId(preferred?.id ?? "");
  }, [modelId, models, preferred?.id]);

  const fxQuery = useQuery<FxDto>({
    queryKey: ["billing-fx"],
    queryFn: () => api.getBillingFx(),
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
  });

  const selected = useMemo(
    () => models.find((m) => m.id === modelId) ?? preferred,
    [models, modelId, preferred],
  );
  const fx = fxQuery.data?.usdToman ?? 235_175;
  const complexity = COMPLEXITIES.find((item) => item.key === complexityKey) ?? COMPLEXITIES[1];

  const estimate = useMemo(() => {
    if (!selected) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        messageCount: 0,
        taskCount: 0,
        effectiveWorkloads: 0,
        messageUsd: 0,
        taskUsd: 0,
        monthlyUsd: 0,
        monthlyToman: 0,
        monthlyCredits: 0,
        tokens: 0,
        messagesEquivalent: 0,
      };
    }

    const inputTokens = parseInteger(input);
    const outputTokens = parseInteger(output);
    const messageCount = parseInteger(messages);
    const taskCount = parseInteger(tasks);
    const baseTokens = inputTokens + outputTokens;
    const effectiveWorkloads = messageCount + taskCount * complexity.multiplier;
    const messageUsd = (inputTokens / 1_000_000) * selected.inputUsdPer1M
      + (outputTokens / 1_000_000) * selected.outputUsdPer1M;
    const taskUsd = messageUsd * complexity.multiplier;
    const monthlyUsd = messageUsd * effectiveWorkloads;
    const providerMicros = Math.ceil(messageUsd * 1_000_000);
    const creditsPerMessage = providerMicros > 0
      ? Math.max(1, Math.ceil((providerMicros / 1000) * (selected.creditMultiplierBps / 100)))
      : 0;
    const taskCredits = Math.ceil(creditsPerMessage * complexity.multiplier);
    const monthlyCreditsEstimate = creditsPerMessage * messageCount + taskCredits * taskCount;

    return {
      inputTokens,
      outputTokens,
      messageCount,
      taskCount,
      effectiveWorkloads,
      messageUsd,
      taskUsd,
      monthlyUsd,
      monthlyToman: monthlyUsd * fx,
      monthlyCredits: monthlyCreditsEstimate,
      tokens: baseTokens * effectiveWorkloads,
      messagesEquivalent: Math.round(effectiveWorkloads),
    };
  }, [selected, input, output, messages, tasks, complexity, fx]);

  const planRows = useMemo(() => {
    return plans.slice(0, 5).map((plan) => {
      const share = plan.monthlyCredits > 0 ? (estimate.monthlyCredits / plan.monthlyCredits) * 100 : 0;
      const messageCapacity = estimate.monthlyCredits > 0
        ? Math.floor(plan.monthlyCredits / Math.max(1, Math.ceil(estimate.monthlyCredits / Math.max(1, estimate.messageCount + estimate.taskCount))))
        : 0;
      return { ...plan, share, messageCapacity };
    });
  }, [plans, estimate.monthlyCredits, estimate.messageCount, estimate.taskCount]);

  const currentPlan = planRows.find((p) => p.monthlyCredits === monthlyCredits);
  const planShare = monthlyCredits ? Math.round((estimate.monthlyCredits / monthlyCredits) * 100) : 0;

  if (!models.length) return null;

  return (
    <section className="cortex-estimator relative overflow-hidden rounded-[26px] border border-primary/15 p-4 sm:p-6">
      <div className="pointer-events-none absolute -end-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -start-12 -bottom-24 size-60 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="cortex-kicker">CORTEX COST LAB</span>
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary"><Orbit className="size-3.5" /></span>
            </div>
            <h3 className="mt-2 text-xl font-black sm:text-2xl">مصرف را قبل از اجرا شبیه‌سازی کن.</h3>
            <p className="mt-1 max-w-2xl text-xs leading-6 text-muted-foreground">
              مدل، توکن، پیام و تسک را انتخاب کن؛ Cortex هزینه تقریبی را به تومان و اعتبار تبدیل می‌کند و نشان می‌دهد هر پلن چه ظرفیتی دارد.
            </p>
          </div>
          <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-[10px] text-primary">
            ۱ دلار ≈ {faNum(fx)} تومان
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[.94fr_1.06fr]">
          <div className="space-y-3">
            <label className="block rounded-2xl border border-border/60 bg-background/55 p-3">
              <span className="flex items-center gap-2 text-[11px] text-muted-foreground"><Gauge className="size-3.5" />مدل هوش مصنوعی</span>
              <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="mt-2 w-full bg-transparent text-sm font-bold outline-none">
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.provider} · {m.displayName}{m.enabledForPlan ? "" : " · خارج از پلن"}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <TokenField label="توکن ورودی / پیام" icon={<Sparkles className="size-3.5" />} value={input} setValue={setInput} placeholder="مثلاً ۴۰۰۰" />
              <TokenField label="توکن خروجی / پیام" icon={<Sparkles className="size-3.5" />} value={output} setValue={setOutput} placeholder="مثلاً ۱۲۰۰" />
              <TokenField label="تعداد پیام" icon={<MessageSquare className="size-3.5" />} value={messages} setValue={setMessages} placeholder="مثلاً ۱۰۰" />
              <TokenField label="تعداد تسک" icon={<Zap className="size-3.5" />} value={tasks} setValue={setTasks} placeholder="مثلاً ۱۰" />
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/45 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold text-muted-foreground">پیچیدگی تسک</span>
                <span className="text-[10px] text-primary">{complexity.label} · ×{faNum(complexity.multiplier)}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {COMPLEXITIES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setComplexityKey(item.key)}
                    className={`rounded-xl border px-2 py-2 text-[10px] font-bold transition ${complexityKey === item.key ? "border-primary/35 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:bg-muted/50"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-5 text-muted-foreground">{complexity.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    setInput(String(preset.input));
                    setOutput(String(preset.output));
                    setMessages(String(preset.messages));
                    setTasks(String(preset.tasks));
                    setComplexityKey(preset.complexity);
                  }}
                  className="rounded-full border border-border/60 bg-background/45 px-3 py-2 text-[10px] font-semibold text-muted-foreground hover:border-primary/25 hover:text-foreground"
                >
                  شبیه‌سازی {preset.label}
                </button>
              ))}
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/45 px-3 py-2 text-[9px] text-muted-foreground">
                <Activity className="size-3" /> تخمین بودجه‌ای، نه صورتحساب قطعی
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ResultCard title="هزینه یک پیام" value={formatTomanCompact(estimate.messageUsd * fx)} detail={`دقیق: ${formatTomanExact(estimate.messageUsd * fx)}`} primary icon={<MessageSquare className="size-4" />} />
            <ResultCard title="هزینه یک تسک" value={formatTomanCompact(estimate.taskUsd * fx)} detail={`دقیق: ${formatTomanExact(estimate.taskUsd * fx)}`} primary icon={<Zap className="size-4" />} />
            <ResultCard title="هزینه سناریوی ماهانه" value={formatTomanCompact(estimate.monthlyToman)} detail={`معادل $${moneyUsd(estimate.monthlyUsd)} · ${faNum(estimate.monthlyCredits)} اعتبار`} icon={<WalletCards className="size-4" />} />
            <ResultCard title="توکن مؤثر سناریو" value={faNum(estimate.tokens)} detail={`${faNum(estimate.inputTokens)} ورودی + ${faNum(estimate.outputTokens)} خروجی در هر پیام`} icon={<Sparkles className="size-4" />} />

            <div className="sm:col-span-2 rounded-2xl border border-primary/15 bg-primary/[.035] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">سناریوی انتخابی</p>
                  <p className="mt-1 text-lg font-black">{faNum(estimate.messageCount)} پیام + {faNum(estimate.taskCount)} تسک</p>
                </div>
                <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[9px] text-primary">{complexity.label}</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <InfoCell label="بار مؤثر" value={faNum(estimate.messagesEquivalent) + " پیام معادل"} />
                <InfoCell label="سهم پلن فعلی" value={planShare > 999 ? "بیش از ۹۹۹٪" : faNum(planShare) + "٪"} />
                <InfoCell label="Overage مرجع" value={overageCreditPriceToman ? formatTomanCompact(overageCreditPriceToman) + " / اعتبار" : "تعریف نشده"} />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <motion.div initial={{ width: 0 }} animate={{ width: Math.min(100, Math.max(2, planShare)) + "%" }} transition={{ duration: .35 }} className="h-full rounded-full bg-gradient-to-r from-primary via-sky-400 to-violet-400" />
              </div>
            </div>

            {!!planRows.length && (
              <div className="sm:col-span-2 rounded-2xl border border-border/60 bg-background/35 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div><p className="text-[10px] text-muted-foreground">مقایسه با پلن‌ها</p><p className="mt-1 text-sm font-bold">همین سناریو روی پلن‌های مختلف</p></div>
                  <Layers3 className="size-4 text-primary" />
                </div>
                <div className="mt-3 space-y-2">
                  {planRows.map((plan) => (
                    <div key={plan.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-border/50 bg-background/45 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{plan.name}{currentPlan?.id === plan.id ? " · پلن فعلی" : ""}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{plan.monthlyCredits ? faNum(plan.monthlyCredits) + " اعتبار ماهانه" : "اعتبار سفارشی"}</p>
                      </div>
                      <div className="text-right text-[10px] text-muted-foreground">
                        <p>{plan.priceToman ? formatTomanCompact(plan.priceToman) : "سفارشی"}</p>
                        <p className={`mt-1 ${plan.share > 100 ? "text-amber-300" : "text-emerald-300"}`}>{plan.monthlyCredits ? (plan.share > 999 ? "بیش از ۹۹۹٪" : faNum(Math.round(plan.share)) + "٪ مصرف") : "بدون سقف نمایشی"}</p>
                      </div>
                      <p className="hidden text-[10px] text-muted-foreground sm:block">{plan.monthlyCredits ? "ظرفیت تقریبی: " + faNum(plan.messageCapacity) : "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <details className="cortex-model-guide mt-4 rounded-2xl border border-border/60 bg-background/30 p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm font-bold">
            <span className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><Orbit className="size-4" /></span>راهنمای مدل‌ها</span>
            <span className="flex items-center gap-2 text-[10px] text-muted-foreground">{faNum(models.length)} مدل · باز/بسته</span>
            <ChevronDown className="size-4 transition-transform [details[open]_&]:rotate-180" />
          </summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {models.map((model, index) => (
              <div key={model.id} className="rounded-xl border border-border/50 bg-background/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/[.08] text-[9px] font-bold text-primary">{faNum(index + 1)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black">{model.displayName}</p>
                      <p className="mt-0.5 text-[9px] text-muted-foreground">{model.provider}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-border/60 px-2 py-1 text-[8px] text-muted-foreground">{model.enabledForPlan ? "فعال" : "پلن محدود"}</span>
                </div>
                <p className="mt-2 text-[10px] leading-5 text-muted-foreground">{describeModel(model)}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[9px]">
                  <span className="rounded-md bg-muted/55 px-2 py-1">ورودی: {formatTomanCompact(model.inputUsdPer1M * fx)} / ۱M</span>
                  <span className="rounded-md bg-muted/55 px-2 py-1">خروجی: {formatTomanCompact(model.outputUsdPer1M * fx)} / ۱M</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-border/50 pt-3 text-[9px] leading-5 text-muted-foreground">
            مرجع قیمت مدل‌ها در Cortex: {pricingVerifiedAt ? new Date(pricingVerifiedAt + "T00:00:00Z").toLocaleDateString("fa-IR") : "آخرین snapshot ثبت‌شده"} · نرخ‌های مدل از snapshot تأمین‌کننده و نرخ ارز از منبع FX سیستم می‌آید. قیمت نهایی هر provider ممکن است با نوع سرویس، cache، batch، منطقه و تغییرات لحظه‌ای متفاوت باشد.
          </p>
        </details>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/35 px-3 py-2 text-[9px] text-muted-foreground">
          <span>FX: {fxQuery.isLoading ? "در حال دریافت…" : fxQuery.data?.stale ? "آخرین نرخ مرجع در دسترس" : "به‌روزرسانی خودکار"} · {fxQuery.data?.source ?? "fallback"}</span>
          <span>آخرین دریافت نرخ: {fxQuery.data?.asOf ? new Date(fxQuery.data.asOf).toLocaleString("fa-IR") : "—"}</span>
        </div>
      </div>
    </section>
  );
}

function ResultCard({
  title,
  value,
  detail,
  icon,
  primary = false,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  primary?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`rounded-2xl border p-4 ${primary ? "border-primary/20 bg-primary/[.055]" : "border-border/60 bg-background/45"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <span className="text-[10px] text-muted-foreground">{title}</span>
      </div>
      <p className="mt-4 text-xl font-black leading-tight sm:text-2xl">{value}</p>
      <p className="mt-1 text-[10px] leading-5 text-muted-foreground">{detail}</p>
    </motion.div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2"><p className="text-[9px] text-muted-foreground">{label}</p><p className="mt-1 text-xs font-black">{value}</p></div>;
}
