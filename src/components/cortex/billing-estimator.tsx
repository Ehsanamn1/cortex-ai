"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  Cpu,
  Gauge,
  Layers3,
  MessageSquare,
  Orbit,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Zap,
} from "lucide-react";

import { faNum, formatCountCompact, formatTomanCompact } from "@/components/cortex/format";
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
  contextWindow: number | null;
  vision: boolean;
  tools: boolean;
  structuredOutput: boolean;
  reasoning: boolean;
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
  { key: "simple", label: "ساده", multiplier: 1.2, description: "FAQ، پاسخ کوتاه و پردازش مستقیم" },
  { key: "standard", label: "استاندارد", multiplier: 2.2, description: "RAG معمولی، منطق چندمرحله‌ای و پاسخ حرفه‌ای" },
  { key: "agentic", label: "Agentic", multiplier: 4, description: "ابزار، RAG، چندمرحله‌ای و تکرار" },
];

const PRESETS = [
  { key: "support", label: "پشتیبانی", input: 1200, output: 600, messages: 1000, tasks: 0, complexity: "standard" as const },
  { key: "sales", label: "فروش و CRM", input: 1800, output: 900, messages: 800, tasks: 50, complexity: "standard" as const },
  { key: "agentic", label: "اتوماسیون Agentic", input: 2500, output: 1500, messages: 300, tasks: 100, complexity: "agentic" as const },
  { key: "astra", label: "GPT-6 Astra", input: 4500, output: 2200, messages: 300, tasks: 60, complexity: "agentic" as const },
];

function parseInteger(value: string): number {
  if (!value.trim()) return 0;
  const normalized = value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٬،,\s]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function sanitizeNumericInput(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[^0-9,٬]/g, "");
}

function moneyUsd(value: number): string {
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
}

function formatTomanExact(value: number): string {
  return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)))} تومان`;
}

function formatCountCompact(value: number): string {
  const amount = Math.max(0, Math.round(value));
  const nf = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
  if (amount >= 1_000_000_000) return `${nf.format(amount / 1_000_000_000)} میلیارد`;
  if (amount >= 1_000_000) return `${nf.format(amount / 1_000_000)} میلیون`;
  if (amount >= 1_000) return `${nf.format(amount / 1_000)} هزار`;
  return faNum(amount);
}

function describeModel(model: EstimatorModel): string {
  const id = model.modelId.toLowerCase();
  if (id.includes("gpt-6-astra")) return "پرچم‌دار برای کارهای end-to-end، استدلال، کدنویسی، تحقیق و استفاده از ابزار.";
  if (id.includes("gpt-6-sol")) return "استدلال قوی و اتوماسیون حرفه‌ای با توازن هزینه و کیفیت.";
  if (id.includes("gpt-6-luna")) return "سریع و اقتصادی برای حجم بالا، پاسخ‌گویی و اتوماسیون سبک.";
  if (id.includes("gpt-5.6-cyber")) return "مدل تخصصی امنیت برای تحقیق آسیب‌پذیری مجاز و تست‌های فنی.";
  if (id.includes("gpt-5.6-terra")) return "مدل متعادل برای استدلال، کدنویسی و گردش‌کارهای دقیق.";
  if (id.includes("gpt-5.6")) return "برای کارهای متنی، کدنویسی و Agentic با توازن سرعت و کیفیت.";
  if (id.includes("gpt-5.5-pro")) return "برای مسائل سخت و خروجی با دقت بالاتر؛ مصرف بالاتر را در نظر بگیر.";
  if (id.includes("gpt-5.5")) return "مدل حرفه‌ای برای کدنویسی و کارهای تخصصی.";
  if (id.includes("gpt-5.4")) return "برای استدلال و کدنویسی حرفه‌ای با چند سطح مصرف.";
  if (id.includes("claude-opus")) return "برای تحلیل عمیق، استدلال طولانی و کارهایی که کیفیت اولویت دارد.";
  if (id.includes("claude-sonnet")) return "تعادل خوب برای تحلیل، تولید محتوا، کدنویسی و Agentها.";
  if (id.includes("claude-haiku")) return "سریع و اقتصادی برای پاسخ‌های پرتعداد و کارهای تکراری.";
  if (id.includes("gemini-3.1-pro")) return "برای استدلال پیچیده و سناریوهای چندرسانه‌ای سطح بالا.";
  if (id.includes("gemini-3.7-flash")) return "Flash سریع برای Agentic، کدنویسی و پردازش روزمره.";
  if (id.includes("gemini-3.1-flash-lite")) return "اقتصادی برای حجم بالا، ترجمه و پردازش ساده.";
  if (id.includes("gemini-3-flash")) return "Flash سریع برای پاسخ‌گویی عمومی و حجم بالا.";
  if (id.includes("gemini-2.5-pro")) return "برای کدنویسی و استدلال پیچیده.";
  if (id.includes("gemini-2.5-flash")) return "مدل سریع و چندرسانه‌ای برای استفاده عمومی.";
  if (id.includes("deepseek-v4-pro")) return "مدل قوی DeepSeek برای استدلال، کدنویسی و کارهای طولانی.";
  if (id.includes("deepseek-flash")) return "اقتصادی و سریع برای حجم بالا و کارهای تکراری.";
  return model.qualityTier === "deep"
    ? "برای کارهای سنگین و چندمرحله‌ای با اولویت کیفیت."
    : model.qualityTier === "premium"
      ? "تعادل کیفیت و هزینه برای سناریوهای حرفه‌ای."
      : "مناسب پاسخ‌گویی سریع و مصرف اقتصادی.";
}

function modelSignals(model: EstimatorModel): string[] {
  const signals: string[] = [];
  if (model.reasoning) signals.push("استدلال");
  if (model.tools) signals.push("ابزار");
  if (model.vision) signals.push("بینایی");
  if (model.structuredOutput) signals.push("خروجی ساختاری");
  return signals;
}

function formatContext(value: number | null): string {
  if (!value) return "نامشخص";
  return value >= 1_000_000 ? `${formatCountCompact(value)} توکن` : `${formatCountCompact(value)} توکن`;
}

function TokenField({
  label,
  icon,
  value,
  setValue,
  placeholder,
  hint,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  setValue: (value: string) => void;
  placeholder: string;
  hint?: string;
}) {
  return (
    <label className="rounded-2xl border border-border/60 bg-background/55 p-3 transition focus-within:border-primary/30 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,.06)]">
      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">{icon}{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => setValue(sanitizeNumericInput(e.target.value))}
        placeholder={placeholder}
        aria-label={label}
        className="mt-2 w-full bg-transparent text-lg font-black tabular-nums outline-none placeholder:text-muted-foreground/30"
      />
      {hint && <span className="mt-1 block text-[9px] text-muted-foreground/60">{hint}</span>}
    </label>
  );
}

export function BillingEstimator({
  models,
  monthlyCredits,
  plans = [],
  overageCreditPriceToman,
  pricingVerifiedAt,
}: Props) {
  const available = models.filter((m) => m.enabledForPlan);
  const preferred =
    available.find((m) => m.modelId.toLowerCase().includes("gpt-6-astra"))
    ?? available[0]
    ?? models[0];

  const [modelId, setModelId] = useState(preferred?.id ?? "");
  const [input, setInput] = useState("4000");
  const [output, setOutput] = useState("1200");
  const [messages, setMessages] = useState("100");
  const [tasks, setTasks] = useState("10");
  const [complexityKey, setComplexityKey] = useState<Complexity["key"]>("standard");

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
    if (!selected) return null;

    const inputTokens = parseInteger(input);
    const outputTokens = parseInteger(output);
    const messageCount = parseInteger(messages);
    const taskCount = parseInteger(tasks);
    const baseTokens = inputTokens + outputTokens;
    const perMessageUsd =
      (inputTokens / 1_000_000) * selected.inputUsdPer1M
      + (outputTokens / 1_000_000) * selected.outputUsdPer1M;
    const perTaskUsd = perMessageUsd * complexity.multiplier;
    const creditsPerMessage = perMessageUsd > 0
      ? Math.max(1, Math.ceil((perMessageUsd * 1_000_000 / 1000) * (selected.creditMultiplierBps / 100)))
      : 0;
    const creditsPerTask = creditsPerMessage ? Math.ceil(creditsPerMessage * complexity.multiplier) : 0;
    const monthlyCreditsEstimate = creditsPerMessage * messageCount + creditsPerTask * taskCount;
    const monthlyUsd = perMessageUsd * messageCount + perTaskUsd * taskCount;
    const monthlyTokens = baseTokens * (messageCount + taskCount * complexity.multiplier);
    const workloadUnits = messageCount + taskCount * complexity.multiplier;

    return {
      inputTokens,
      outputTokens,
      messageCount,
      taskCount,
      baseTokens,
      perMessageUsd,
      perTaskUsd,
      monthlyUsd,
      monthlyToman: monthlyUsd * fx,
      monthlyCredits: monthlyCreditsEstimate,
      monthlyTokens,
      workloadUnits,
      creditsPerMessage,
      creditsPerTask,
    };
  }, [selected, input, output, messages, tasks, complexity, fx]);

  const planRows = useMemo(() => {
    if (!estimate) return [];
    const workloadUnits = estimate.workloadUnits;
    const creditsPerWorkload = workloadUnits > 0 ? estimate.monthlyCredits / workloadUnits : 0;
    return plans.slice(0, 5).map((plan) => ({
      ...plan,
      share: plan.monthlyCredits > 0 ? (estimate.monthlyCredits / plan.monthlyCredits) * 100 : 0,
      workloadCapacity: creditsPerWorkload > 0 ? Math.floor(plan.monthlyCredits / creditsPerWorkload) : 0,
    }));
  }, [plans, estimate]);

  const currentPlan = planRows.find((p) => p.monthlyCredits === monthlyCredits);
  const planShare = monthlyCredits && estimate ? Math.round((estimate.monthlyCredits / monthlyCredits) * 100) : 0;
  const guideModels = useMemo(() => {
    const seen = new Set<string>();
    return models.filter((model) => {
      if (seen.has(model.id)) return false;
      seen.add(model.id);
      return true;
    }).slice(0, 25);
  }, [models]);
  const signals = selected ? modelSignals(selected) : [];
  const hasInputProfile = Boolean(estimate && estimate.baseTokens > 0);
  const hasWorkload = Boolean(estimate && estimate.workloadUnits > 0);

  function applyPreset(preset: (typeof PRESETS)[number]) {
    if (preset.key === "astra") {
      const astra = models.find((model) => model.modelId.toLowerCase().includes("gpt-6-astra"));
      if (astra) setModelId(astra.id);
    }
    setInput(String(preset.input));
    setOutput(String(preset.output));
    setMessages(String(preset.messages));
    setTasks(String(preset.tasks));
    setComplexityKey(preset.complexity);
  }

  if (!models.length) return null;

  return (
    <section className="cortex-estimator relative overflow-hidden rounded-[26px] border border-primary/15 p-4 sm:p-6">
      <div className="pointer-events-none absolute -end-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -start-16 -bottom-28 size-64 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="cortex-kicker">CORTEX COST LAB</span>
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary"><Orbit className="size-3.5" /></span>
              <span className="rounded-full border border-primary/15 bg-primary/[.04] px-2.5 py-1 text-[9px] text-primary">{faNum(guideModels.length)} مدل مرجع</span>
            </div>
            <h3 className="mt-2 text-xl font-black sm:text-2xl">هزینه را قبل از اجرا ببین.</h3>
            <p className="mt-1 max-w-3xl text-xs leading-6 text-muted-foreground">
              توکن، پیام و تسک را خودت تعیین کن. Cortex هزینه‌ی تقریبی مدل، اعتبار مصرفی و ظرفیت پلن را به تومان نشان می‌دهد.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-[10px] font-semibold text-primary">
              ۱ دلار ≈ {faNum(fx)} تومان
            </div>
            <div className="rounded-xl border border-border/60 bg-background/45 px-3 py-2 text-[9px] text-muted-foreground">
              نرخ ارز هر ۱۵ دقیقه تازه‌سازی می‌شود
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[.86fr_1.14fr]">
          <div className="space-y-3">
            <label className="block rounded-2xl border border-border/60 bg-background/55 p-3">
              <span className="flex items-center gap-2 text-[11px] text-muted-foreground"><Gauge className="size-3.5" />مدل هوش مصنوعی</span>
              <select
                value={models.some((model) => model.id === modelId) ? modelId : (preferred?.id ?? "")}
                onChange={(e) => setModelId(e.target.value)}
                className="mt-2 w-full bg-transparent text-sm font-bold outline-none"
              >
                {guideModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.provider} · {m.displayName}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full border border-border/60 px-2 py-1 text-[8px] text-muted-foreground">{selected?.speedTier ?? "—"}</span>
                <span className="rounded-full border border-border/60 px-2 py-1 text-[8px] text-muted-foreground">{selected?.qualityTier ?? "—"}</span>
                {signals.map((signal) => <span key={signal} className="inline-flex items-center gap-1 rounded-full border border-primary/10 bg-primary/5 px-2 py-1 text-[8px] text-primary"><Check className="size-2.5"/>{signal}</span>)}
              </div>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <TokenField label="توکن ورودی / پیام" icon={<Sparkles className="size-3.5" />} value={input} setValue={setInput} placeholder="مثلاً ۴۰۰۰" hint="خالی بگذاری، صفر محاسباتی می‌شود؛ خود فیلد خالی می‌ماند." />
              <TokenField label="توکن خروجی / پیام" icon={<Sparkles className="size-3.5" />} value={output} setValue={setOutput} placeholder="مثلاً ۱۲۰۰" />
              <TokenField label="تعداد پیام در ماه" icon={<MessageSquare className="size-3.5" />} value={messages} setValue={setMessages} placeholder="مثلاً ۱۰۰" />
              <TokenField label="تعداد تسک در ماه" icon={<Zap className="size-3.5" />} value={tasks} setValue={setTasks} placeholder="مثلاً ۱۰" />
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/45 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold text-muted-foreground">پیچیدگی تسک</span>
                <span className="text-[10px] font-bold text-primary">×{faNum(complexity.multiplier)}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {COMPLEXITIES.map((item) => (
                  <button key={item.key} type="button" onClick={() => setComplexityKey(item.key)} className={`rounded-xl border px-2 py-2 text-[10px] font-bold transition ${complexityKey === item.key ? "border-primary/35 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:bg-muted/50"}`}>
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-5 text-muted-foreground">{complexity.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button key={preset.key} type="button" onClick={() => applyPreset(preset)} className="rounded-full border border-border/60 bg-background/45 px-3 py-2 text-[10px] font-semibold text-muted-foreground transition hover:border-primary/25 hover:text-foreground">
                  {preset.key === "astra" ? "شبیه‌سازی GPT-6 Astra" : `شبیه‌سازی ${preset.label}`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ResultCard title="هزینه یک پیام" value={hasInputProfile && estimate ? formatTomanCompact(estimate.perMessageUsd * fx) : "—"} detail={hasInputProfile && estimate ? `دقیق: ${formatTomanExact(estimate.perMessageUsd * fx)}` : "توکن ورودی و خروجی را وارد کن"} primary icon={<MessageSquare className="size-4" />} />
            <ResultCard title="هزینه یک تسک" value={hasInputProfile && estimate ? formatTomanCompact(estimate.perTaskUsd * fx) : "—"} detail={hasInputProfile && estimate ? `دقیق: ${formatTomanExact(estimate.perTaskUsd * fx)} · پیچیدگی ×${faNum(complexity.multiplier)}` : "توکن‌ها را وارد کن"} primary icon={<Zap className="size-4" />} />
            <ResultCard title="هزینه سناریوی ماهانه" value={hasWorkload && estimate ? formatTomanCompact(estimate.monthlyToman) : "—"} detail={hasWorkload && estimate ? `معادل $${moneyUsd(estimate.monthlyUsd)}` : "تعداد پیام یا تسک را وارد کن"} icon={<WalletCards className="size-4" />} />
            <ResultCard title="اعتبار مصرفی ماهانه" value={hasWorkload && estimate ? formatCountCompact(estimate.monthlyCredits) : "—"} detail={hasWorkload && estimate ? `${faNum(estimate.creditsPerMessage)} اعتبار/پیام · ${faNum(estimate.creditsPerTask)} اعتبار/تسک` : "بر اساس نرخ مدل و پلن"} icon={<Cpu className="size-4" />} />

            <div className="sm:col-span-2 rounded-2xl border border-primary/15 bg-primary/[.035] p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">شبیه‌ساز مصرف</p>
                  <p className="mt-1 text-lg font-black">{hasWorkload && estimate ? `${formatCountCompact(estimate.messageCount)} پیام + ${formatCountCompact(estimate.taskCount)} تسک در ماه` : "سناریوی خودت را بساز"}</p>
                  <p className="mt-1 max-w-2xl text-[10px] leading-5 text-muted-foreground">
                    این بخش قدرت فنی مدل را از روی قابلیت‌های ثبت‌شده نشان می‌دهد و هزینه را بر اساس توکن و workload تخمین می‌زند؛ امتیاز ساختگی برای «هوش» مدل تولید نمی‌کند.
                  </p>
                </div>
                {selected && (
                  <div className="w-full rounded-2xl border border-white/[.06] bg-background/45 p-3 md:max-w-[310px]">
                    <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><Bot className="size-4"/></span><div className="min-w-0"><p className="truncate text-xs font-black">{selected.displayName}</p><p className="truncate text-[9px] text-muted-foreground">{selected.provider} · {formatContext(selected.contextWindow)}</p></div></div>
                    <p className="mt-2 text-[10px] leading-5 text-muted-foreground">{describeModel(selected)}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {signals.map((signal) => <span key={signal} className="rounded-full bg-primary/[.07] px-2 py-1 text-[8px] text-primary">{signal}</span>)}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <InfoCell label="توکن مؤثر ماهانه" value={hasWorkload && estimate ? formatCountCompact(estimate.monthlyTokens) : "—"} />
                <InfoCell label="بار کاری مؤثر" value={hasWorkload && estimate ? formatCountCompact(estimate.workloadUnits) + " واحد" : "—"} />
                <InfoCell label="سهم پلن فعلی" value={hasWorkload && monthlyCredits ? (planShare > 999 ? "بیش از ۹۹۹٪" : faNum(planShare) + "٪") : "—"} />
              </div>

              {hasWorkload && monthlyCredits > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[9px] text-muted-foreground"><span>مصرف تخمینی نسبت به پلن فعلی</span><span>{planShare > 999 ? "بیش از سقف" : faNum(planShare) + "٪"}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div initial={{ width: 0 }} animate={{ width: Math.min(100, Math.max(2, planShare)) + "%" }} transition={{ duration: .3 }} className="h-full rounded-full bg-gradient-to-r from-primary via-sky-400 to-violet-400" />
                  </div>
                </div>
              )}
            </div>

            {!!planRows.length && (
              <div className="sm:col-span-2 rounded-2xl border border-border/60 bg-background/35 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div><p className="text-[10px] text-muted-foreground">اثر روی پلن</p><p className="mt-1 text-sm font-bold">همین workload روی پلن‌های مختلف</p></div>
                  <Layers3 className="size-4 text-primary" />
                </div>
                <div className="mt-3 space-y-2">
                  {planRows.map((plan) => (
                    <div key={plan.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-border/50 bg-background/45 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{plan.name}{currentPlan?.id === plan.id ? " · پلن فعلی" : ""}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{plan.monthlyCredits ? `${formatCountCompact(plan.monthlyCredits)} اعتبار ماهانه` : "اعتبار سفارشی"}</p>
                      </div>
                      <div className="text-right text-[10px] text-muted-foreground">
                        <p>{plan.priceToman ? formatTomanCompact(plan.priceToman) : "سفارشی"}</p>
                        <p className={`mt-1 ${plan.share > 100 ? "text-amber-300" : "text-emerald-300"}`}>{plan.monthlyCredits && hasWorkload ? (plan.share > 999 ? "بیش از ۹۹۹٪" : faNum(Math.round(plan.share)) + "٪ مصرف") : "—"}</p>
                      </div>
                      <p className="hidden text-[10px] text-muted-foreground sm:block">{plan.workloadCapacity ? "ظرفیت تقریبی: " + formatCountCompact(plan.workloadCapacity) + " واحد" : "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <details className="cortex-model-guide mt-4 rounded-2xl border border-border/60 bg-background/30 p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm font-bold">
            <span className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><BrainCircuit className="size-4" /></span>راهنمای ۲۵ مدل</span>
            <span className="flex items-center gap-2 text-[9px] text-muted-foreground"><ShieldCheck className="size-3.5 text-emerald-300"/>{faNum(guideModels.length)} مدل · جمع‌وجور</span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform [details[open]_&]:rotate-180" />
          </summary>

          <div className="mt-2 max-h-[380px] overflow-y-auto rounded-xl border border-border/50 bg-background/25 p-2">
            <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
              {guideModels.map((model, index) => {
                const modelSignalsList = modelSignals(model);
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setModelId(model.id)}
                    className={`group rounded-xl border p-3 text-right transition ${selected?.id === model.id ? "border-primary/25 bg-primary/[.06]" : "border-border/50 bg-background/45 hover:border-primary/20 hover:bg-background/70"}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/[.08] text-[9px] font-black text-primary">{faNum(index + 1)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-black">{model.displayName}</p>
                          {selected?.id === model.id && <Check className="size-3.5 shrink-0 text-primary" />}
                        </div>
                        <p className="mt-0.5 truncate text-[8px] text-muted-foreground">{model.provider} · {model.modelId}</p>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[9px] leading-5 text-muted-foreground">{describeModel(model)}</p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <span className="rounded-lg bg-muted/40 px-2 py-1.5 text-[8px] text-muted-foreground">ورودی: <b className="text-foreground">{formatTomanCompact(model.inputUsdPer1M * fx)}</b> / ۱M</span>
                      <span className="rounded-lg bg-muted/40 px-2 py-1.5 text-[8px] text-muted-foreground">خروجی: <b className="text-foreground">{formatTomanCompact(model.outputUsdPer1M * fx)}</b> / ۱M</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-border/60 px-2 py-1 text-[8px] text-muted-foreground">{model.qualityTier}</span>
                      <span className="rounded-full border border-border/60 px-2 py-1 text-[8px] text-muted-foreground">{model.speedTier}</span>
                      {modelSignalsList.slice(0, 3).map((signal) => <span key={signal} className="rounded-full bg-primary/[.05] px-2 py-1 text-[8px] text-primary">{signal}</span>)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2 rounded-xl border border-border/50 bg-background/30 px-3 py-2 text-[9px] leading-5 text-muted-foreground">
            <span className="font-semibold text-foreground">مرجع نرخ:</span> {pricingVerifiedAt ? new Date(pricingVerifiedAt + "T00:00:00Z").toLocaleDateString("fa-IR") : "آخرین snapshot"} · قیمت‌های مدل در این رابط، نرخ استاندارد مرجع‌اند؛ cache، batch، fast/priority، ابزارهای پولی و long-context ممکن است نرخ نهایی را تغییر دهند.
          </div>
        </details>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/35 px-3 py-2 text-[9px] text-muted-foreground">
          <span>نرخ ارز: {fxQuery.isLoading ? "در حال دریافت…" : fxQuery.data?.stale ? "آخرین نرخ در دسترس" : "به‌روزرسانی خودکار"} · {fxQuery.data?.source ?? "fallback"}</span>
          <span>آخرین دریافت: {fxQuery.data?.asOf ? new Date(fxQuery.data.asOf).toLocaleString("fa-IR") : "—"}</span>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[9px] text-muted-foreground">
          <Activity className="size-3.5 text-primary" />
          هزینه‌های این آزمایش «تخمینی» هستند و جایگزین صورتحساب واقعی اجرای Cortex نیستند.
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
    <motion.div whileHover={{ y: -2 }} className={`rounded-2xl border p-4 ${primary ? "border-primary/20 bg-primary/[.055]" : "border-border/60 bg-background/45"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <span className="text-[10px] text-muted-foreground">{title}</span>
      </div>
      <p className="mt-4 text-xl font-black leading-tight tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-1 text-[10px] leading-5 text-muted-foreground">{detail}</p>
    </motion.div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-black tabular-nums">{value}</p>
    </div>
  );
}
