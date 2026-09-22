
"use client";

import { useQuery } from "@tanstack/react-query";
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
  Workflow,
} from "lucide-react";

import { api } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { EmptyState, ErrorState, useErrorToast } from "@/components/cortex/bits";
import { faNum, timeAgoFa } from "@/components/cortex/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function CortexCore() {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: "easeOut" }} className="relative mx-auto h-[250px] w-[250px] sm:h-[310px] sm:w-[310px]">
      <div className="cortex-core-orbit cortex-orbit-a" />
      <div className="cortex-core-orbit cortex-orbit-b" />
      <div className="cortex-core-orbit cortex-orbit-c" />
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: "linear" }} className="absolute inset-[16%] rounded-full border border-primary/20" />
      <motion.div animate={{ scale: [1, 1.04, 1], rotate: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="cortex-core-sphere absolute inset-[19%] rounded-full">
        <div className="absolute inset-6 rounded-full border border-white/10 bg-[radial-gradient(circle_at_32%_26%,rgba(255,255,255,.48),transparent_12%),radial-gradient(circle_at_55%_44%,rgba(59,130,255,.98),transparent_38%),radial-gradient(circle_at_72%_72%,rgba(139,92,246,.96),transparent_48%),#07101c] shadow-[0_0_120px_rgba(59,130,255,.33),inset_0_1px_0_rgba(255,255,255,.16)]">
          <div className="absolute inset-[18%] rounded-full border border-primary/20" />
          <div className="absolute left-[18%] top-[17%] size-4 rounded-full bg-white/50 blur-[3px]" />
          <motion.div animate={{ opacity: [0.28, 0.7, 0.28] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-[9%] rounded-full border border-violet-400/30" />
        </div>
      </motion.div>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <p className="text-[10px] font-bold tracking-[.28em] text-primary/80">هسته Cortex</p>
        <p className="mt-1 text-xs text-slate-400">مرکز کنترل هوش و دانش</p>
      </div>
    </motion.div>
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

  const providersQuery = useQuery({
    queryKey: ["providers-status", activeWorkspaceId],
    queryFn: () => api.getProvidersStatus(activeWorkspaceId ?? undefined),
    enabled: !!activeWorkspaceId,
    staleTime: 30_000,
  });

  useErrorToast(dashboardQuery.isError ? dashboardQuery.error : null);
  useErrorToast(providersQuery.isError ? providersQuery.error : null);

  if (dashboardQuery.isPending) return <DashboardSkeleton />;
  if (dashboardQuery.isError || !dashboardQuery.data) {
    return <ErrorState message={dashboardQuery.error instanceof Error ? dashboardQuery.error.message : "دریافت اطلاعات داشبورد ناموفق بود."} onRetry={() => void dashboardQuery.refetch()} />;
  }

  const { stats, recentAgents, recentConversations, activity = [] } = dashboardQuery.data;
  const providers = providersQuery.data;
  const hasAgents = stats.agents > 0;
  const llmReady = providers?.llm.status === "configured";
  const embeddingsReady = providers?.embeddings.status === "configured" || providers?.embeddings.mode === "lexical";
  const vectorReady = providers?.vectorStore.status === "ready";
  const providerReadyCount = [llmReady, embeddingsReady, vectorReady].filter(Boolean).length;

  return (
    <div className="space-y-7">
      <section className="cortex-hero relative overflow-hidden rounded-[30px] border border-white/[.08]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_16%,rgba(59,130,255,.18),transparent_28%),radial-gradient(circle_at_20%_78%,rgba(139,92,246,.13),transparent_25%),linear-gradient(145deg,#111824,#070a0f)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.05)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="relative z-10 grid items-center gap-3 px-5 py-6 sm:px-8 lg:grid-cols-[1.04fr_.96fr] lg:px-10 lg:py-7">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="cortex-kicker">مرکز فرماندهی</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />فضای کاری فعال
              </span>
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[42px] lg:leading-[1.15]">
              {siteConfigQuery.data?.settings["site.welcomeTitle"] ?? "هوش کسب‌وکار را"}
              <span className="block bg-gradient-to-l from-primary via-cyan-300 to-violet-400 bg-clip-text text-transparent">از یک داشبورد کنترل کن.</span>
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
            <div className="absolute bottom-3 left-2 hidden rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-md sm:block">
              <p className="text-[10px] tracking-[.18em] text-slate-500">زیرساخت</p>
              <p className="mt-1 text-sm font-semibold text-white">{faNum(providerReadyCount)} از ۳ سرویس آماده</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="آمار کلی" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={Bot} label="ایجنت‌ها" value={faNum(stats.activeAgents)} caption={faNum(stats.agents) + " ایجنت ثبت شده"} tint="border-primary/25 bg-primary/10 text-primary" />
        <StatCard icon={Library} label="منابع دانش" value={faNum(stats.knowledgeReady)} caption={faNum(stats.knowledgeSources) + " منبع در مجموع"} tint="border-violet-400/25 bg-violet-400/10 text-violet-300" />
        <StatCard icon={MessagesSquare} label="گفتگوها" value={faNum(stats.conversations)} caption={faNum(stats.messages) + " پیام در مجموع"} tint="border-emerald-400/25 bg-emerald-400/10 text-emerald-300" />
        <StatCard icon={Activity} label="امروز" value={faNum(stats.todayMessages ?? 0)} caption={faNum(stats.todayTokens ?? 0) + " توکن امروز"} tint="border-amber-400/25 bg-amber-400/10 text-amber-300" />
      </section>

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

      {!hasAgents ? (
        <EmptyState icon={<DashboardEmptyIllustration />} title="هنوز ایجنتی نساخته‌اید" description="اولین ایجنت خود را بسازید، دانش را به آن وصل کنید و بعد از پلی‌گراند پاسخ بگیرید." action={<Button onClick={() => setView("agent-new")}><Plus />ایجاد ایجنت</Button>} className="bg-card py-16" />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
