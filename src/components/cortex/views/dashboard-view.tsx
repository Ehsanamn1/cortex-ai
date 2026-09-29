
"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpLeft,
  BarChart3,
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

import { api, type DashboardStatsDto } from "@/lib/cortex-client";
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
        <span>سیگنال‌های Runtime</span>
      </div>
    </div>
  );
}

function DashboardOnboarding({
  onNavigate,
  recentAgentId,
  onOpenAgent,
}: {
  onNavigate: (view: "knowledge" | "agent-new" | "agents") => void;
  recentAgentId?: string;
  onOpenAgent: (agentId: string, tab: "overview" | "ai" | "playground") => void;
}) {
  const hasAgent = Boolean(recentAgentId);
  const steps = [
    { number: "۱", title: hasAgent ? "Agent ساخته شده" : "اولین Agent را بساز", description: hasAgent ? "هویت و تنظیمات Agent آماده است؛ برای ادامه وارد آن شو." : "نام، لحن و قوانین پاسخ‌گویی Agent را تعیین کن.", action: "create" as const, done: hasAgent },
    { number: "۲", title: "مدل و هوش Agent", description: hasAgent ? "مدل مدیریت‌شده Cortex را انتخاب کن و کیفیت پاسخ را تنظیم کن." : "بعد از ساخت Agent، مدل مناسب را انتخاب کن.", action: "ai" as const, done: false },
    { number: "۳", title: "دانش کسب‌وکار", description: "فایل‌ها و دانش واقعی کسب‌وکارت را اضافه کن تا پاسخ‌ها grounded شوند.", action: "knowledge" as const, done: false },
    { number: "۴", title: "تست و انتشار", description: hasAgent ? "در Playground تست کن و بعد Agent را از API یا Telegram منتشر کن." : "پس از ساخت Agent، اولین پاسخ را در Playground بررسی کن.", action: "playground" as const, done: false },
  ];

  return (
    <motion.section initial={{ opacity: 0, y: -8, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative overflow-hidden rounded-[28px] border border-primary/20 bg-card/70 p-5 shadow-[0_24px_70px_rgba(101,124,46,.08)] sm:p-6">
      <div className="absolute -start-20 -top-24 size-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="cortex-kicker">SETUP PATH</p>
            <h2 className="mt-2 text-xl font-black sm:text-2xl">آموزش و راه‌اندازی قدم‌به‌قدم</h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">همه مراحل اصلی راه‌اندازی Cortex را از همین داشبورد دنبال کن؛ این بخش همیشه در دسترس می‌ماند.</p>
          </div>
          <div className="rounded-full border border-border/70 bg-background/45 px-3 py-1.5 text-[9px] font-bold text-primary">{hasAgent ? "۱ از ۴ مرحله پایه انجام شده" : "شروع از مرحله ۱"}</div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <motion.button key={step.number} type="button" disabled={step.action !== "create" && !hasAgent} whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: .985 }} transition={{ duration: .16 }}
              onClick={() => {
                if (step.action === "create") { if (recentAgentId) onOpenAgent(recentAgentId, "overview"); else onNavigate("agent-new"); return; }
                if (step.action === "knowledge") { onNavigate("knowledge"); return; }
                if (recentAgentId) onOpenAgent(recentAgentId, step.action);
              }}
              className={cn("group relative min-h-[158px] overflow-hidden rounded-2xl border p-4 text-right transition-all", step.done ? "border-emerald-400/20 bg-emerald-400/[.055]" : "border-border/70 bg-background/50 hover:border-primary/25 hover:bg-primary/[.035]", "disabled:cursor-not-allowed disabled:opacity-45")}
            >
              <span className={cn("grid size-10 place-items-center rounded-xl border text-sm font-black transition-transform group-hover:scale-105", step.done ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-primary/15 bg-primary/10 text-primary")}>{step.done ? <CircleCheck className="size-4" /> : step.number}</span>
              <p className="mt-5 text-sm font-black">{step.title}</p>
              <p className="mt-1.5 text-[11px] leading-6 text-muted-foreground">{step.description}</p>
              <span className="absolute bottom-3 end-4 text-[9px] font-bold text-primary opacity-0 transition group-hover:opacity-100">باز کردن ←</span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function DashboardEmptyIllustration() {
  return (
    <svg width="180" height="120" viewBox="0 0 180 120" fill="none" aria-hidden="true">
      <path d="M90 18 122 36.5v37L90 92 58 73.5v-37L90 18Z" stroke="rgba(148,163,184,0.25)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M90 38 106.5 47.5v19L90 76 73.5 66.5v-19L90 38Z" stroke="rgba(101,124,46,0.45)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="90" cy="57" r="6" fill="#8cab3e" fillOpacity="0.9" />
      <circle cx="90" cy="57" r="11" stroke="rgba(101,124,46,0.3)" strokeWidth="2" />
      <circle cx="58" cy="36.5" r="3" fill="#657c2e" fillOpacity="0.8" />
      <circle cx="122" cy="36.5" r="3" fill="#657c2e" fillOpacity="0.8" />
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

function DashboardLaunchpad({
  onNavigate,
  recentAgentId,
  onOpenAgent,
}: {
  onNavigate: (view: "agents" | "knowledge" | "telegram" | "analytics" | "workflows") => void;
  recentAgentId?: string;
  onOpenAgent: (agentId: string, tab: "overview" | "ai" | "playground") => void;
}) {
  const items = [
    { title: "ساخت Agent", desc: "ایجاد دستیار جدید", icon: Bot, action: () => onNavigate("agents") },
    { title: "افزودن دانش", desc: "PDF، DOCX و URL", icon: BookPlus, action: () => onNavigate("knowledge") },
    { title: "انتشار روی Telegram", desc: "اتصال کانال", icon: Send, action: () => onNavigate("telegram") },
    { title: "تحلیل عملکرد", desc: "مصرف و رفتار", icon: BarChart3, action: () => onNavigate("analytics") },
    { title: "گردش‌کارها", desc: "اتوماسیون مرحله‌ای", icon: Workflow, action: () => onNavigate("workflows") },
    { title: "Playground", desc: "تست پاسخ واقعی", icon: MessageSquare, action: () => recentAgentId && onOpenAgent(recentAgentId, "playground") },
  ];
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div><p className="cortex-kicker">EXECUTION PATH</p><h2 className="mt-1 text-lg font-black">مسیرهای اصلی اجرا</h2></div>
        <span className="hidden text-[10px] text-muted-foreground sm:inline">ساخت، اتصال، دانش و انتشار در یک نما</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const disabled = item.title === "Playground" && !recentAgentId;
          return (
            <motion.button key={item.title} type="button" onClick={item.action} disabled={disabled} whileHover={{ y: -3 }} whileTap={{ scale: .98 }}
              className="group flex min-h-[90px] items-center gap-3 rounded-2xl border border-border/70 bg-card/55 p-4 text-right transition-all hover:border-primary/25 hover:bg-primary/[.035] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary transition-transform group-hover:scale-105"><Icon className="size-4" /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-black">{item.title}</span><span className="mt-1 block text-[10px] text-muted-foreground">{item.desc}</span></span>
              <ArrowUpLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:-translate-x-0.5" />
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

function DashboardSystemPulse({ stats, activity }: { stats: DashboardStatsDto; activity: Array<{id:string;action:string;entityType:string;createdAt:string}> }) {
  const signals = [
    { ready: stats.agents > 0, label: "موتور Agent", detail: stats.agents > 0 ? faNum(stats.agents) + " Agent" : "در انتظار راه‌اندازی" },
    { ready: stats.knowledgeReady > 0, label: "مغز کسب‌وکار", detail: stats.knowledgeReady > 0 ? faNum(stats.knowledgeReady) + " منبع آماده" : "هنوز دانش آماده نشده" },
    { ready: stats.conversations > 0, label: "گفتگو", detail: stats.conversations > 0 ? faNum(stats.conversations) + " گفتگوی ثبت‌شده" : "هنوز مکالمه‌ای ثبت نشده" },
    { ready: (stats.telegramBots ?? 0) > 0, label: "Telegram", detail: (stats.telegramBots ?? 0) > 0 ? faNum(stats.telegramBots ?? 0) + " ربات" : "قابل راه‌اندازی" },
  ];
  return (
    <Card className="cortex-panel h-full rounded-2xl">
      <CardHeader><p className="cortex-kicker">SYSTEM PULSE</p><CardTitle className="mt-2 text-base">نبض عملیاتی Cortex</CardTitle></CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        <div className="grid grid-cols-2 gap-2">{signals.map((signal) => <HealthPill key={signal.label} ready={signal.ready} label={signal.label} detail={signal.detail} />)}</div>
        <div className="mt-2 rounded-2xl border border-border/60 bg-background/35 p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-bold">در ۳۰ روز</span><span className="text-[9px] text-muted-foreground">{faNum(stats.totalUsageEvents ?? 0)} رویداد</span></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-lg font-black">{faNum(stats.totalTokens ?? 0)}</p><p className="text-[9px] text-muted-foreground">توکن</p></div>
            <div><p className="text-lg font-black">{faNum(stats.messages ?? 0)}</p><p className="text-[9px] text-muted-foreground">پیام</p></div>
            <div><p className="text-lg font-black">{faNum(stats.knowledgeReady ?? 0)}</p><p className="text-[9px] text-muted-foreground">منبع آماده</p></div>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between"><span className="text-xs font-bold">آخرین رویدادها</span><span className="text-[9px] text-muted-foreground">{faNum(activity.length)} مورد</span></div>
          {activity.length === 0 ? <p className="rounded-xl border border-dashed border-border/70 p-4 text-center text-[10px] text-muted-foreground">هنوز فعالیتی ثبت نشده؛ اولین Agent یا منبع دانش را بساز.</p> : activity.slice(0,4).map((item) => <div key={item.id} className="flex items-center gap-2 rounded-xl border border-border/55 bg-background/25 px-3 py-2"><span className="size-2 rounded-full bg-primary/70"/><span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{item.action} · {item.entityType}</span><span className="shrink-0 text-[9px] text-muted-foreground">{timeAgoFa(item.createdAt)}</span></div>)}
        </div>
      </CardContent>
    </Card>
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
  const billingQuery = useQuery({
    queryKey: ["billing", activeWorkspaceId],
    queryFn: () => api.getBilling(activeWorkspaceId ?? undefined),
    enabled: !!activeWorkspaceId,
    staleTime: 20_000,
  });

  if (dashboardQuery.isPending || billingQuery.isPending) return <DashboardSkeleton />;
  if (dashboardQuery.isError) {
    return <ErrorState title="داشبورد موقتاً در دسترس نیست" message={dashboardQuery.error instanceof Error ? dashboardQuery.error.message : "دریافت اطلاعات داشبورد ناموفق بود."} onRetry={() => void dashboardQuery.refetch()} />;
  }

  const data = dashboardQuery.data ?? {
    stats: { agents: 0, activeAgents: 0, knowledgeSources: 0, knowledgeReady: 0, conversations: 0, messages: 0, telegramBots: 0, totalUsageEvents: 0, totalTokens: 0, estimatedCostMicros: 0, todayMessages: 0, todayTokens: 0 },
    recentAgents: [],
    recentConversations: [],
    activity: [],
  };
  const { stats, recentAgents, recentConversations } = data;
  const billing = billingQuery.data;
  const plan = billing?.account.plan;
  const balance = billing?.account.balanceCredits ?? 0;
  const monthlyCredits = plan?.monthlyCredits ?? 0;
  const remainingPct = monthlyCredits > 0 ? Math.min(100, Math.max(0, Math.round((balance / monthlyCredits) * 100))) : 0;
  const lowBalance = monthlyCredits > 0 && remainingPct <= 20;
  const recentAgentId = recentAgents[0]?.id;

  return (
    <div className="space-y-5 pb-2 sm:space-y-7">
      {billing && (
        <motion.section
          initial={{ opacity: 0, y: -10, scale: .985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: .42, ease: "easeOut" }}
          className={cn("relative overflow-hidden rounded-[30px] border p-4 shadow-[0_30px_90px_rgba(15,23,42,.14)] sm:p-6 lg:p-7", lowBalance ? "border-amber-400/25 bg-amber-400/[.045]" : "border-primary/20 bg-primary/[.045]")}
        >
          <div className="absolute -end-20 -top-24 size-72 rounded-full bg-primary/10 blur-3xl animate-pulse" />
          <div className="absolute -start-24 -bottom-28 size-64 rounded-full bg-primary/5 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="cortex-kicker">CORTEX WALLET</span>
                <motion.span animate={{ y: [0, -2, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black text-primary">{plan?.name ?? "پلن"}</motion.span>
                <span className="rounded-full border border-border/70 bg-background/45 px-2.5 py-1 text-[9px] text-muted-foreground">اعتبار امن و کنترل‌شده</span>
              </div>
              <h2 className="mt-3 text-2xl font-black sm:text-3xl">وضعیت اعتبار و مصرف هوش</h2>
              <p className="mt-2 max-w-xl text-xs leading-6 text-muted-foreground">موجودی، سطح مدل‌ها و مصرف را در یک نمای زنده ببین و بدون خارج‌شدن از داشبورد به پلن و مدل دسترسی پیدا کن.</p>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-[9px] text-muted-foreground">اعتبار فعلی</p><p className="mt-1 text-lg font-black">{faNum(balance)}</p></div>
                <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-[9px] text-muted-foreground">پلن</p><p className="mt-1 truncate text-sm font-black">{plan?.name ?? "—"}</p></div>
                <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-[9px] text-muted-foreground">توکن امروز</p><p className="mt-1 text-lg font-black">{faNum(stats.todayTokens ?? 0)}</p></div>
                <div className="rounded-2xl border border-primary/15 bg-primary/[.06] p-3"><p className="text-[9px] text-muted-foreground">مصرف ماهانه</p><p className="mt-1 text-lg font-black">{faNum(remainingPct)}٪</p></div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground"><span>{lowBalance ? "اعتبار رو به اتمام است" : "اعتبار قابل استفاده"}</span><span>{faNum(balance)} از {faNum(monthlyCredits)} اعتبار</span></div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: String(remainingPct || (monthlyCredits === 0 ? 0 : 1)) + "%" }} transition={{ duration: .9, ease: "easeOut" }} className={cn("h-full rounded-full", lowBalance ? "bg-amber-400" : "bg-gradient-to-r from-primary via-primary to-primary")} /></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => setView("billing")}><WalletCards />مدیریت پلن و اعتبار</Button>
                {recentAgentId && <Button variant="outline" onClick={() => openAgent(recentAgentId, "ai")}><Sparkles />انتخاب مدل</Button>}
                {lowBalance && <Button size="sm" variant="outline" onClick={() => setView("billing")}>شارژ سریع</Button>}
              </div>
            </div>
            <div className="relative min-h-[210px] sm:min-h-[250px]"><CortexCore /></div>
          </div>
        </motion.section>
      )}

      <section aria-label="آمار کلی" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={Bot} label="ایجنت‌ها" value={faNum(stats.activeAgents)} caption={faNum(stats.agents) + " ایجنت ثبت شده"} tint="border-primary/25 bg-primary/10 text-primary" />
        <StatCard icon={Library} label="منابع دانش" value={faNum(stats.knowledgeReady)} caption={faNum(stats.knowledgeSources) + " منبع در مجموع"} tint="border-primary/20 bg-primary/5 text-primary" />
        <StatCard icon={MessagesSquare} label="گفتگوها" value={faNum(stats.conversations)} caption={faNum(stats.messages) + " پیام در مجموع"} tint="border-emerald-400/25 bg-emerald-400/10 text-emerald-300" />
        <StatCard icon={Activity} label="امروز" value={faNum(stats.todayMessages ?? 0)} caption={faNum(stats.todayTokens ?? 0) + " توکن امروز"} tint="border-amber-400/25 bg-amber-400/10 text-amber-300" />
      </section>

      <Capabilities onOpen={setView} />

      <DashboardOnboarding
        onNavigate={(next) => setView(next)}
        recentAgentId={recentAgentId}
        onOpenAgent={(agentId, tab) => openAgent(agentId, tab)}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <DashboardLaunchpad onNavigate={(next) => setView(next)} recentAgentId={recentAgentId} onOpenAgent={(agentId, tab) => openAgent(agentId, tab)} />
        <DashboardSystemPulse stats={stats} activity={data.activity ?? []} />
      </div>

      <section className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="cortex-panel rounded-2xl">
          <CardHeader className="flex-row items-center justify-between border-b border-white/[.06]">
            <div><p className="cortex-kicker">AGENTS</p><CardTitle className="mt-2 text-base">ایجنت‌های اخیر</CardTitle></div>
            <Button variant="ghost" size="sm" onClick={() => setView("agents")}>همه</Button>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {recentAgents.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">هنوز ایجنتی نساخته‌ای.</p> : recentAgents.slice(0, 5).map((agent) => (
              <button key={agent.id} type="button" onClick={() => openAgent(agent.id)} className="flex w-full items-center gap-3 rounded-xl border border-white/[.06] p-3 text-start transition hover:border-primary/25 hover:bg-primary/[.03]">
                <span className="cortex-icon-box size-10 shrink-0"><Bot className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{agent.name}</span><span className="mt-1 block text-[10px] text-muted-foreground">ویرایش {timeAgoFa(agent.updatedAt)}</span></span>
                <ArrowUpLeft className="size-3.5 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="cortex-panel rounded-2xl">
          <CardHeader className="flex-row items-center justify-between border-b border-white/[.06]">
            <div><p className="cortex-kicker">ACTIVITY</p><CardTitle className="mt-2 text-base">گفتگوهای اخیر</CardTitle></div>
            <Button variant="ghost" size="sm" onClick={() => setView("conversations")}>همه</Button>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {recentConversations.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">هنوز گفتگویی ثبت نشده.</p> : recentConversations.slice(0, 5).map((conversation) => (
              <button key={conversation.id} type="button" onClick={() => openConversation(conversation.agentId, conversation.id)} className="flex w-full items-center gap-3 rounded-xl border border-white/[.06] p-3 text-start transition hover:border-primary/25 hover:bg-primary/[.03]">
                <span className="cortex-icon-box size-10 shrink-0"><MessageSquare className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{conversation.title}</span><span className="mt-1 block truncate text-[10px] text-muted-foreground">{conversation.agentName} · {timeAgoFa(conversation.updatedAt)}</span></span>
                <ArrowUpLeft className="size-3.5 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}