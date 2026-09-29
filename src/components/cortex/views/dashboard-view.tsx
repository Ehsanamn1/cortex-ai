
"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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

function DashboardOnboarding({
  onNavigate,
  recentAgentId,
  onOpenAgent,
}: {
  onNavigate: (view: "knowledge" | "agent-new" | "agents") => void;
  recentAgentId?: string;
  onOpenAgent: (agentId: string, tab: "ai" | "playground") => void;
}) {
  const [open, setOpen] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem("cortex:onboarding:dismissed") !== "1",
  );

  function dismiss() {
    window.localStorage.setItem("cortex:onboarding:dismissed", "1");
    setOpen(false);
  }

  if (!open) return null;

  const hasAgent = Boolean(recentAgentId);
  const steps = [
    {
      number: "۱",
      title: hasAgent ? "ورود به اولین Agent" : "اولین Agent را بساز",
      description: hasAgent ? "هویت، دانش و تنظیمات همین Agent را ادامه بده." : "نام، لحن و قوانین پاسخ‌گویی را تعیین کن.",
      action: "create" as const,
      disabled: false,
    },
    {
      number: "۲",
      title: "مدل را داخل Agent تنظیم کن",
      description: hasAgent ? "Provider، مدل و API Key را از تب «مدل و هوش مصنوعی» تنظیم کن." : "بعد از ساخت Agent، مدل اختصاصی آن را تنظیم کن.",
      action: "ai" as const,
      disabled: !hasAgent,
    },
    {
      number: "۳",
      title: "در Playground تست کن",
      description: hasAgent ? "قبل از انتشار، پاسخ واقعی همان Agent را بررسی کن." : "بعد از ساخت Agent، اولین پاسخ را تست کن.",
      action: "playground" as const,
      disabled: !hasAgent,
    },
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
            disabled={step.disabled}
            onClick={() => {
              if (step.action === "create") {
                if (recentAgentId) {
                  onOpenAgent(recentAgentId, "overview");
                  dismiss();
                } else {
                  onNavigate("agent-new");
                }
                return;
              }
              if (!recentAgentId) return;
              onOpenAgent(recentAgentId, step.action);
              dismiss();
            }}
            className="cortex-action min-h-[142px] rounded-2xl border border-border/60 bg-background/45 p-4 text-right disabled:cursor-not-allowed disabled:opacity-45"
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
    <div className="space-y-5 sm:space-y-7">
      {billing && (
        <motion.section
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "relative overflow-hidden rounded-[24px] border p-4 sm:rounded-[30px] sm:p-6",
            lowBalance ? "border-amber-400/25 bg-amber-400/[.045]" : "border-primary/20 bg-primary/[.045]"
          )}
        >
          <div className="absolute -end-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="cortex-kicker">CORTEX WALLET</p>
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <h2 className="text-2xl font-black sm:text-3xl">{plan?.name ?? "پلن"}</h2>
                  <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[10px] text-primary">کنترل مصرف فعال</span>
                </div>
                <p className="mt-2 max-w-xl text-xs leading-6 text-muted-foreground">پلن، مدل‌های در دسترس و اعتبارت را از یک مسیر ساده مدیریت کن. Provider و API Key توسط Cortex مدیریت می‌شوند.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setView("billing")}><WalletCards />مدیریت پلن و اعتبار</Button>
                {recentAgentId && <Button variant="outline" onClick={() => openAgent(recentAgentId, "ai")}><Sparkles />انتخاب مدل</Button>}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{lowBalance ? "اعتبار رو به اتمام است" : "اعتبار قابل استفاده"}</span>
                  <span>{faNum(balance)} از {faNum(monthlyCredits)} اعتبار</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-all", lowBalance ? "bg-amber-400" : "bg-gradient-to-r from-primary to-violet-400")} style={{ width: (remainingPct || (monthlyCredits === 0 ? 0 : 1)) + "%" }} />
                </div>
              </div>
              <p className={cn("text-xs font-bold sm:text-end", lowBalance ? "text-amber-300" : "text-primary")}>{faNum(remainingPct)}٪ باقی‌مانده</p>
            </div>

            {lowBalance && (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/[.05] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold">اعتبارت در حال تمام شدن است.</p>
                  <p className="mt-1 text-[10px] leading-5 text-muted-foreground">برای اینکه درخواست‌های آینده متوقف نشوند، همین حالا اعتبارت را شارژ کن.</p>
                </div>
                <Button size="sm" onClick={() => setView("billing")}>همین حالا شارژ کن</Button>
              </div>
            )}
          </div>
        </motion.section>
      )}

      <section aria-label="آمار کلی" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={Bot} label="ایجنت‌ها" value={faNum(stats.activeAgents)} caption={faNum(stats.agents) + " ایجنت ثبت شده"} tint="border-primary/25 bg-primary/10 text-primary" />
        <StatCard icon={Library} label="منابع دانش" value={faNum(stats.knowledgeReady)} caption={faNum(stats.knowledgeSources) + " منبع در مجموع"} tint="border-violet-400/25 bg-violet-400/10 text-violet-300" />
        <StatCard icon={MessagesSquare} label="گفتگوها" value={faNum(stats.conversations)} caption={faNum(stats.messages) + " پیام در مجموع"} tint="border-emerald-400/25 bg-emerald-400/10 text-emerald-300" />
        <StatCard icon={Activity} label="امروز" value={faNum(stats.todayMessages ?? 0)} caption={faNum(stats.todayTokens ?? 0) + " توکن امروز"} tint="border-amber-400/25 bg-amber-400/10 text-amber-300" />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {[
          { title: "ساخت Agent", text: "ایجنت جدید بساز و آماده انتخاب مدلش کن.", icon: Bot, onClick: () => setView("agent-new") },
          { title: "مدل و هوش مصنوعی", text: recentAgentId ? "مدل Agent فعلی را عوض کن یا سطح قوی‌تری باز کن." : "ابتدا یک Agent بساز.", icon: Sparkles, onClick: () => recentAgentId ? openAgent(recentAgentId, "ai") : setView("agent-new") },
          { title: "پایگاه دانش", text: "فایل، متن یا URL را به دانش Agent اضافه کن.", icon: BookPlus, onClick: () => setView("knowledge") },
          { title: "Telegram", text: "Bot، شماره‌ها و شخصی‌سازی را مدیریت کن.", icon: Send, onClick: () => setView("telegram") },
        ].map((item) => (
          <button key={item.title} type="button" onClick={item.onClick} className="cortex-action group min-h-[118px] rounded-2xl border border-white/[.07] bg-white/[.02] p-4 text-start sm:min-h-[132px]">
            <div className="flex items-start justify-between gap-3"><span className="cortex-icon-box"><item.icon className="size-[18px]" /></span><ArrowUpLeft className="size-4 text-muted-foreground transition group-hover:-translate-y-1 group-hover:-translate-x-1" /></div>
            <p className="mt-5 text-sm font-bold">{item.title}</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">{item.text}</p>
          </button>
        ))}
      </section>

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