
"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpLeft,
  Bot,
  BookPlus,
  ChevronLeft,
  CircleCheck,
  CircleDashed,
  FileText,
  Library,
  MessageSquare,
  MessagesSquare,
  Plus,
  Send,
  Server,
  Sparkles,
  TriangleAlert,
  Workflow,
  X,
  WalletCards,
} from "lucide-react";

import { api } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { ErrorState, useErrorToast } from "@/components/cortex/bits";
import { faNum, timeAgoFa } from "@/components/cortex/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Capabilities } from "@/components/cortex/capabilities";

function CortexCore() {
  const nodes = [
    { x: "18%", y: "31%", delay: "0s" },
    { x: "77%", y: "26%", delay: ".7s" },
    { x: "83%", y: "58%", delay: "1.4s" },
    { x: "24%", y: "74%", delay: "2.1s" },
    { x: "51%", y: "13%", delay: "2.8s" },
    { x: "48%", y: "88%", delay: "3.5s" },
  ];

  return (
    <div className="cortex-core-v2" aria-label="هسته Cortex">
      <div className="cortex-core-v2-haze" />
      <div className="cortex-core-v2-ring cortex-core-v2-ring-1" />
      <div className="cortex-core-v2-ring cortex-core-v2-ring-2" />
      <div className="cortex-core-v2-ring cortex-core-v2-ring-3" />
      {nodes.map((node, i) => (
        <span key={i} className="cortex-core-v2-node" style={{ left: node.x, top: node.y, animationDelay: node.delay }} />
      ))}
      <div className="cortex-core-v2-orb">
        <div className="cortex-core-v2-orb-shine" />
        <div className="cortex-core-v2-orb-grid" />
        <div className="cortex-core-v2-orb-dot" />
      </div>
      <div className="cortex-core-v2-caption">
        <p>هسته Cortex</p>
        <span>مرکز کنترل هوش و دانش</span>
      </div>
    </div>
  );
}

function DashboardOnboarding({ onNavigate }: { onNavigate: (view: "knowledge" | "agent-new" | "agents") => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem("cortex:onboarding:dismissed") === "1";
    if (!dismissed) setOpen(true);
  }, []);

  function dismiss() {
    window.localStorage.setItem("cortex:onboarding:dismissed", "1");
    setOpen(false);
  }

  if (!open) return null;

  const steps: Array<{ number: string; title: string; description: string; view: "knowledge" | "agent-new" | "agents" }> = [
    { number: "۱", title: "اولین دانش را آپلود کن", description: "PDF، متن یا URL شرکت را اضافه کن.", view: "knowledge" },
    { number: "۲", title: "اولین Agent را بساز", description: "لحن و قوانین پاسخ‌گویی را تنظیم کن.", view: "agent-new" },
    { number: "۳", title: "در Playground تست کن", description: "قبل از اتصال به مشتری، پاسخ واقعی بگیر.", view: "agents" },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: -8, scale: .99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative overflow-hidden rounded-[26px] border border-primary/20 bg-primary/[.045] p-5 shadow-[0_22px_70px_rgba(59,130,255,.08)] sm:p-6"
    >
      <button type="button" onClick={dismiss} aria-label="بستن راهنمای شروع" className="absolute end-3 top-3 grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-background/50 hover:text-foreground">
        <X className="size-4" />
      </button>
      <div className="max-w-3xl">
        <p className="cortex-kicker">FIRST RUN</p>
        <h2 className="mt-2 text-xl font-black sm:text-2xl">در ۳ قدم Cortex را راه بینداز.</h2>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">این راهنمای شروع فقط برای اولین ورود است و هر زمان خواستی می‌توانی ببندی.</p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <button
            key={step.number}
            type="button"
            onClick={() => { dismiss(); onNavigate(step.view); }}
            className="cortex-action min-h-[142px] rounded-2xl border border-border/60 bg-background/45 p-4 text-right"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-sm font-black text-primary">{step.number}</span>
            <p className="mt-5 text-sm font-bold">{step.title}</p>
            <p className="mt-1 text-[11px] leading-6 text-muted-foreground">{step.description}</p>
          </button>
        ))}
      </div>
      <button type="button" onClick={dismiss} className="mt-4 text-[10px] font-semibold text-muted-foreground transition hover:text-foreground">بعداً ادامه می‌دهم</button>
    </motion.section>
  );
}

function DashboardEmptyIllustration() {
  return (
    <svg width="180" height="120" viewBox="0 0 180 120" fill="none" aria-hidden="true">
      <path d="M90 18 122 36.5v37L90 92 58 73.5v-37L90 18Z" stroke="rgba(148,163,184,0.25)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M90 38 106.5 47.5v19L90 76 73.5 66.5v-19L90 38Z" stroke="rgba(59,130,255,0.45)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="90" cy="57" r="6" fill="#3B82FF" fillOpacity="0.9" />
      <circle cx="90" cy="57" r="11" stroke="rgba(59,130,255,0.3)" strokeWidth="2" />
      <circle cx="58" cy="36.5" r="3" fill="#8B5CF6" fillOpacity="0.8" />
      <circle cx="122" cy="36.5" r="3" fill="#8B5CF6" fillOpacity="0.8" />
      <circle cx="58" cy="73.5" r="3" fill="rgba(148,163,184,0.5)" />
      <circle cx="122" cy="73.5" r="3" fill="rgba(148,163,184,0.5)" />
    </svg>
  );
}

function StatCard({ icon: Icon, value, caption, tint, label }: { icon: typeof Bot; value: string; caption: string; tint: string; label: string }) {
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }} className="h-full">
      <Card className="cortex-panel h-full rounded-2xl py-5">
        <CardContent className="flex items-center gap-4 px-5">
          <span aria-hidden="true" className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl border", tint)}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold leading-none text-foreground">{value}</p>
            <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{caption}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function HealthPill({ ready, label, detail }: { ready: boolean; label: string; detail: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-full border border-white/[.07] bg-white/[.025] px-3 py-2">
      {ready ? <CircleCheck className="size-4 shrink-0 text-emerald-400" /> : <CircleDashed className="size-4 shrink-0 text-amber-400" />}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground">{label}</p>
        <p className="truncate text-[10px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[110px] rounded-2xl" />)}</div>
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><Skeleton className="h-[420px] rounded-[30px]" /><Skeleton className="h-[420px] rounded-[30px]" /></div>
    </div>
  );
}

export function DashboardView() {
  const setView = useCortexStore((s) => s.setView);
  const openAgent = useCortexStore((s) => s.openAgent);
  const openConversation = useCortexStore((s) => s.openConversation);
  const activeWorkspaceId = useCortexStore((s) => s.activeWorkspaceId);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", activeWorkspaceId],
    queryFn: () => api.getDashboard(activeWorkspaceId ?? undefined),
    enabled: !!activeWorkspaceId,
  });

  const siteConfigQuery = useQuery({
    queryKey: ["site-config"],
    queryFn: api.getSiteConfig,
    staleTime: 60_000,
  });

  const billingQuery = useQuery({
    queryKey: ["billing", activeWorkspaceId],
    queryFn: () => api.getBilling(activeWorkspaceId ?? undefined),
    enabled: !!activeWorkspaceId,
    staleTime: 20_000,
  });

  const providersQuery = useQuery({
    queryKey: ["providers-status", activeWorkspaceId],
    queryFn: () => api.getProvidersStatus(activeWorkspaceId ?? undefined),
    enabled: !!activeWorkspaceId,
    staleTime: 30_000,
  });

  // Dashboard data is non-critical UI telemetry. A backend data failure must
  // never replace the whole workspace with a scary internal-error screen.
  // Keep the shell usable and let React Query retry in the background.
  useErrorToast(providersQuery.isError ? providersQuery.error : null);

  if (dashboardQuery.isPending) return <DashboardSkeleton />;
  if (dashboardQuery.isError) {
    const message = dashboardQuery.error instanceof Error
      ? dashboardQuery.error.message
      : "دریافت اطلاعات داشبورد با خطا مواجه شد.";
    return <ErrorState title="داشبورد موقتاً در دسترس نیست" message={message} onRetry={() => void dashboardQuery.refetch()} />;
  }

  const dashboardData = dashboardQuery.data ?? {
    stats: {
      agents: 0, activeAgents: 0, knowledgeSources: 0, knowledgeReady: 0,
      conversations: 0, messages: 0, telegramBots: 0, totalUsageEvents: 0,
      totalTokens: 0, estimatedCostMicros: 0, todayMessages: 0, todayTokens: 0,
    },
    recentAgents: [],
    recentConversations: [],
    activity: [],
  };

  const { stats, recentAgents, recentConversations, activity = [] } = dashboardData;
  const providers = providersQuery.data;
  const settingEnabled = (key: string, fallback = true) => siteConfigQuery.data?.settings[key] === undefined ? fallback : siteConfigQuery.data.settings[key] !== "false";
  const hasAgents = stats.agents > 0;
  const llmReady = providers?.llm.status === "configured";
  const embeddingsReady = providers?.embeddings.status === "configured" || providers?.embeddings.mode === "lexical";
  const vectorReady = providers?.vectorStore.status === "ready";
  const providerReadyCount = [llmReady, embeddingsReady, vectorReady].filter(Boolean).length;

  return (
    <div className="space-y-7">
      {!hasAgents && <DashboardOnboarding onNavigate={setView} />}

      {settingEnabled("feature.dashboardHero") && (
      <section className="cortex-hero relative overflow-hidden rounded-[30px] border border-white/[.08]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_16%,rgba(59,130,255,.18),transparent_28%),radial-gradient(circle_at_20%_78%,rgba(139,92,246,.13),transparent_25%),linear-gradient(145deg,#111824,#070a0f)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.05)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="relative z-10 grid items-center gap-3 px-5 py-5 sm:px-8 lg:grid-cols-[1.04fr_.96fr] lg:px-10 lg:py-6">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="cortex-kicker">مرکز کنترل</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />فضای کاری فعال
              </span>
            </div>
            <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[38px] lg:leading-[1.16]">
              {siteConfigQuery.data?.settings["site.welcomeTitle"] ?? "مرکز کنترل هوش کسب‌وکار"}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-8 text-slate-300">ایجنت‌ها، دانش، گفتگوها، اتصال‌ها و مصرف منابع از همین‌جا مدیریت می‌شوند؛ آمار این صفحه از فضای کاری فعلی خوانده می‌شود.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-primary">RAG و دانش</span>
              <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs text-violet-300">ایجنت‌های قابل کنترل</span>
              <span className="rounded-full border border-white/10 bg-white/[.035] px-3 py-1.5 text-xs text-slate-300">چند فضای کاری</span>
            </div>
            <div className="mt-7 grid max-w-xl grid-cols-3 gap-2">
              <HealthPill ready={llmReady} label="مدل زبانی" detail={providers?.llm.model ?? "نیازمند پیکربندی"} />
              <HealthPill ready={embeddingsReady} label="بازیابی دانش" detail={providers?.embeddings.mode === "lexical" ? "واژگانی محلی" : providers?.embeddings.model ?? "نیازمند پیکربندی"} />
              <HealthPill ready={vectorReady} label="پایگاه برداری" detail={providers?.vectorStore.provider === "qdrant" ? "Qdrant" : "محلی"} />
            </div>
          </div>
          <div className="relative flex min-h-[260px] items-center justify-center lg:min-h-[340px]">
            <div className="absolute size-48 rounded-full bg-primary/10 blur-3xl sm:size-64" />
            <CortexCore />
            <div className="cortex-infra-badge absolute bottom-3 left-2 hidden rounded-2xl px-4 py-3 backdrop-blur-md sm:block">
              <p className="cortex-infra-label text-[10px] tracking-[.18em]">زیرساخت</p>
              <p className="cortex-infra-value mt-1 text-sm font-semibold">{faNum(providerReadyCount)} از ۳ سرویس آماده</p>
            </div>
          </div>
        </div>
      </section>

      )}

      {!llmReady && providers && (
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[.055] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
              <TriangleAlert className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold">مدل زبانی هنوز پیکربندی نشده است</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">قبل از تست ایجنت، سرویس مدل و کلید API را در تنظیمات متصل کنید.</p>
            </div>
          </div>
          <Button variant="outline" className="shrink-0 border-amber-400/20 bg-background/30" onClick={() => setView("settings")}>پیکربندی مدل</Button>
        </motion.section>
      )}

      <section aria-label="آمار کلی" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={Bot} label="ایجنت‌ها" value={faNum(stats.activeAgents)} caption={faNum(stats.agents) + " ایجنت ثبت شده"} tint="border-primary/25 bg-primary/10 text-primary" />
        <StatCard icon={Library} label="منابع دانش" value={faNum(stats.knowledgeReady)} caption={faNum(stats.knowledgeSources) + " منبع در مجموع"} tint="border-violet-400/25 bg-violet-400/10 text-violet-300" />
        <StatCard icon={MessagesSquare} label="گفتگوها" value={faNum(stats.conversations)} caption={faNum(stats.messages) + " پیام در مجموع"} tint="border-emerald-400/25 bg-emerald-400/10 text-emerald-300" />
        <StatCard icon={Activity} label="امروز" value={faNum(stats.todayMessages ?? 0)} caption={faNum(stats.todayTokens ?? 0) + " توکن امروز"} tint="border-amber-400/25 bg-amber-400/10 text-amber-300" />
      </section>

      {billingQuery.data && (
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          whileTap={{ scale: .99 }}
          onClick={() => setView("billing")}
          className="cortex-wallet-mini group relative overflow-hidden rounded-[24px] border border-primary/15 bg-gradient-to-br from-primary/[.09] via-background to-violet-500/[.06] p-5 text-right"
        >
          <span className="absolute -end-10 -top-16 size-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><span className="cortex-kicker">CORTEX WALLET</span><span className="rounded-full border border-primary/15 bg-primary/5 px-2 py-1 text-[9px] text-primary">{billingQuery.data.account.plan.name}</span></div>
              <p className="mt-3 text-2xl font-black">{faNum(billingQuery.data.account.balanceCredits)} <span className="text-xs font-semibold text-muted-foreground">اعتبار</span></p>
              <p className="mt-1 text-xs text-muted-foreground">{faNum(billingQuery.data.usage30Days.credits)} اعتبار مصرف‌شده در ۳۰ روز اخیر</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid size-16 place-items-center rounded-2xl border border-white/10 bg-black/10 shadow-inner">
                <WalletCards className="size-7 text-primary transition-transform duration-300 group-hover:rotate-6" />
              </div>
              <div className="text-left"><p className="text-xs font-semibold text-primary">مدیریت اعتبار</p><p className="mt-1 text-[10px] text-muted-foreground">شارژ، Ledger و صورتحساب</p></div>
            </div>
          </div>
        </motion.button>
      )}

      <Capabilities onOpen={setView} />

      {settingEnabled("feature.dashboardQuickActions") && (
      <section aria-label="عملیات و وضعیت" className="grid items-start gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="cortex-panel overflow-hidden rounded-2xl">
          <CardHeader className="border-b border-white/[.06]">
            <div><p className="cortex-kicker">عملیات سریع</p><CardTitle className="mt-2 text-base">از این‌جا ادامه بده</CardTitle></div>
            <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[10px] text-primary">{faNum(stats.agents + stats.knowledgeSources + stats.conversations)} رکورد</span>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            {[
              { title: "ساخت ایجنت", description: "رفتار، لحن و دستورالعمل پاسخ‌گویی را تنظیم کن.", icon: Bot, view: "agent-new" as const },
              { title: "افزودن دانش", description: "فایل یا URL واقعی را وارد کن و وضعیت پردازش را ببین.", icon: BookPlus, view: "knowledge" as const },
              { title: "گفتگوها", description: "مکالمات ثبت‌شده را باز کن و پاسخ‌ها را بررسی کن.", icon: MessagesSquare, view: "conversations" as const },
              { title: "اتصال تلگرام", description: "ربات را به یکی از ایجنت‌های این فضا وصل کن.", icon: Send, view: "telegram" as const },
            ].map((action) => (
              <button key={action.title} type="button" onClick={() => setView(action.view)} className="cortex-action group relative flex min-h-[128px] flex-col justify-between rounded-2xl border border-white/[.07] bg-white/[.02] p-4 text-start">
                <div className="flex items-start justify-between gap-3"><span className="cortex-icon-box"><action.icon className="size-[18px]" /></span><ArrowUpLeft className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1" /></div>
                <div className="relative z-10 mt-5"><p className="text-sm font-semibold">{action.title}</p><p className="mt-1 text-xs leading-6 text-muted-foreground">{action.description}</p></div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="cortex-panel overflow-hidden rounded-2xl">
          <CardHeader className="border-b border-white/[.06]">
            <div><p className="cortex-kicker">سلامت و مصرف</p><CardTitle className="mt-2 text-base">وضعیت فضای کاری</CardTitle></div>
            <div className="flex size-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary"><Server className="size-4" /></div>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3"><p className="text-[11px] text-muted-foreground">ربات تلگرام</p><p className="mt-1 text-xl font-bold">{faNum(stats.telegramBots ?? 0)}</p></div>
              <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3"><p className="text-[11px] text-muted-foreground">رویداد مصرف</p><p className="mt-1 text-xl font-bold">{faNum(stats.totalUsageEvents ?? 0)}</p></div>
              <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3"><p className="text-[11px] text-muted-foreground">توکن کل</p><p className="mt-1 text-xl font-bold">{faNum(stats.totalTokens ?? 0)}</p></div>
              <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3"><p className="text-[11px] text-muted-foreground">هزینه ثبت‌شده</p><p className="mt-1 text-xl font-bold">{faNum(stats.estimatedCostMicros ?? 0)}</p></div>
            </div>
            <div className="rounded-xl border border-white/[.06] bg-black/10 p-3">
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Workflow className="size-4 text-primary" /><span className="text-xs font-medium">اتصال‌های زیرساخت</span></div><span className={cn("text-xs font-semibold", providerReadyCount === 3 ? "text-emerald-400" : "text-amber-400")}>{faNum(providerReadyCount)} / ۳</span></div>
              <div className="mt-3 flex gap-1.5">{[0,1,2].map((i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < providerReadyCount ? "bg-emerald-400" : "bg-white/10")} />)}</div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setView("settings")}><Sparkles className="size-4" />پیکربندی اتصال‌ها</Button>
          </CardContent>
        </Card>
      </section>

      )}

      {!hasAgents ? (
        <section className="cortex-panel overflow-hidden rounded-[26px] border border-primary/10 p-5 sm:p-7">
          <div className="grid items-center gap-6 lg:grid-cols-[.72fr_1.28fr]">
            <div className="text-center lg:text-start">
              <div className="mx-auto grid size-20 place-items-center rounded-[24px] border border-primary/15 bg-primary/[.06] lg:mx-0">
                <DashboardEmptyIllustration />
              </div>
              <p className="mt-4 text-lg font-black">اولین ایجنتت را در ۳ قدم بساز</p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">از دانش سازمان تا اولین پاسخ، مسیر را همین‌جا شروع کن.</p>
              <Button className="mt-4" onClick={() => setView("knowledge")}><Plus />شروع از دانش</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["۱", "آپلود دانش", "PDF، متن یا URL را اضافه کن.", "knowledge"],
                ["۲", "ساخت ایجنت", "لحن و قوانین پاسخ‌گویی را تعیین کن.", "agent-new"],
                ["۳", "تست در پلی‌گراند", "قبل از انتشار با ایجنت گفتگو کن.", "agents"],
              ].map(([number, title, description, target]) => (
                <button
                  key={number}
                  type="button"
                  onClick={() => setView(target as "knowledge" | "agent-new" | "agents")}
                  className="cortex-action min-h-[150px] rounded-2xl border border-white/[.07] bg-white/[.02] p-4 text-right"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-sm font-black text-primary">{number}</span>
                  <p className="mt-7 text-sm font-bold">{title}</p>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <>
          {settingEnabled("feature.dashboardRecent") && (
            <section className="grid items-start gap-5 lg:grid-cols-2">
              <Card className="cortex-panel rounded-2xl">
                <CardHeader className="border-b border-white/[.06]">
                  <CardTitle className="flex items-center gap-2 text-base"><Bot className="size-4 text-primary" />ایجنت‌های اخیر</CardTitle>
                  <CardAction><Button variant="ghost" size="sm" className="text-primary" onClick={() => setView("agents")}>مشاهده همه<ChevronLeft /></Button></CardAction>
                </CardHeader>
                <CardContent className="pt-2">
                  {recentAgents.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">هنوز ایجنتی وجود ندارد.</p> : (
                    <ul className="divide-y divide-white/[.06]">{recentAgents.slice(0, 5).map((agent) => (
                      <li key={agent.id}><button type="button" onClick={() => openAgent(agent.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-start transition-colors hover:bg-white/[.035]">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary"><Bot className="size-[18px]" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{agent.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">به‌روزرسانی {timeAgoFa(agent.updatedAt)}</span></span>
                        <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
                      </button></li>
                    ))}</ul>
                  )}
                </CardContent>
              </Card>

              <Card className="cortex-panel rounded-2xl">
                <CardHeader className="border-b border-white/[.06]">
                  <CardTitle className="flex items-center gap-2 text-base"><MessagesSquare className="size-4 text-secondary" />گفتگوهای اخیر</CardTitle>
                  <CardAction><Button variant="ghost" size="sm" className="text-primary" onClick={() => setView("conversations")}>مشاهده همه<ChevronLeft /></Button></CardAction>
                </CardHeader>
                <CardContent className="pt-2">
                  {recentConversations.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">هنوز گفتگویی ثبت نشده است.</p> : (
                    <ul className="divide-y divide-white/[.06]">{recentConversations.slice(0, 5).map((conversation) => (
                      <li key={conversation.id}><button type="button" onClick={() => openConversation(conversation.agentId, conversation.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-start transition-colors hover:bg-white/[.035]">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-secondary/15 bg-secondary/10 text-secondary"><MessageSquare className="size-[18px]" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{conversation.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{conversation.agentName} · {timeAgoFa(conversation.updatedAt)}</span></span>
                        <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
                      </button></li>
                    ))}</ul>
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {settingEnabled("feature.dashboardActivity") && (
            <Card className="cortex-panel overflow-hidden rounded-2xl">
              <CardHeader className="border-b border-white/[.06]">
                <div><p className="cortex-kicker">فعالیت سیستم</p><CardTitle className="mt-2 text-base">آخرین رخدادهای ثبت‌شده</CardTitle></div>
                <div className="flex size-9 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/10 text-emerald-400"><Activity className="size-4" /></div>
              </CardHeader>
              <CardContent className="p-0">
                {activity.length === 0 ? (
                  <div className="px-5 py-12 text-center"><FileText className="mx-auto size-8 text-muted-foreground/40" /><p className="mt-3 text-sm font-medium">هنوز رخدادی ثبت نشده است.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">ساخت ایجنت، مدیریت دانش و گفتگوها در این بخش دیده می‌شوند.</p></div>
                ) : (
                  <ul className="divide-y divide-white/[.06]">{activity.slice(0, 6).map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-3.5"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[.07] bg-white/[.025]"><Activity className="size-3.5 text-primary" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.action}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{item.entityType} · {timeAgoFa(item.createdAt)}</p></div></li>
                  ))}</ul>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
