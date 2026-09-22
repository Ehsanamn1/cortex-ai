"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, ArrowUpLeft, Bot, BookPlus, ChevronLeft, FileText, Library, MessageSquare, MessagesSquare, Plus, Send } from "lucide-react";

import { api } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { EmptyState, ErrorState, useErrorToast } from "@/components/cortex/bits";
import { faNum, timeAgoFa } from "@/components/cortex/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";


function CortexCore(){return <motion.div initial={{opacity:0,scale:.85}} animate={{opacity:1,scale:1}} transition={{duration:.7,ease:'easeOut'}} className="relative mx-auto h-64 w-64 sm:h-72 sm:w-72">
  <div className="cortex-core-orbit cortex-orbit-a"/><div className="cortex-core-orbit cortex-orbit-b"/><div className="cortex-core-orbit cortex-orbit-c"/>
  <motion.div animate={{rotate:360}} transition={{duration:24,repeat:Infinity,ease:'linear'}} className="absolute inset-[19%] rounded-full border border-primary/20"/>
  <motion.div animate={{scale:[1,1.04,1],rotate:[0,-8,0]}} transition={{duration:4,repeat:Infinity,ease:'easeInOut'}} className="cortex-core-sphere absolute inset-[21%] rounded-full">
    <div className="absolute inset-6 rounded-full border border-white/10 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,.35),transparent_14%),radial-gradient(circle_at_55%_48%,rgba(59,130,255,.95),transparent_38%),radial-gradient(circle_at_70%_75%,rgba(139,92,246,.95),transparent_48%),#08111f] shadow-[0_0_90px_rgba(59,130,255,.35),inset_0_1px_0_rgba(255,255,255,.14)]"/>
  </motion.div>
  <div className="absolute inset-x-0 bottom-0 text-center"><p className="text-[10px] font-semibold tracking-[.28em] text-primary/80">CORTEX CORE</p><p className="mt-1 text-xs text-muted-foreground">هوش در حال سازمان‌دهی</p></div>
</motion.div>}

function DashboardEmptyIllustration() {
  return (
    <svg width="180" height="120" viewBox="0 0 180 120" fill="none" aria-hidden="true">
      <path
        d="M90 18 122 36.5v37L90 92 58 73.5v-37L90 18Z"
        stroke="rgba(148,163,184,0.25)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M90 38 106.5 47.5v19L90 76 73.5 66.5v-19L90 38Z"
        stroke="rgba(59,130,255,0.45)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="90" cy="57" r="6" fill="#3B82FF" fillOpacity="0.9" />
      <circle cx="90" cy="57" r="11" stroke="rgba(59,130,255,0.3)" strokeWidth="2" />
      <circle cx="58" cy="36.5" r="3" fill="#8B5CF6" fillOpacity="0.8" />
      <circle cx="122" cy="36.5" r="3" fill="#8B5CF6" fillOpacity="0.8" />
      <circle cx="58" cy="73.5" r="3" fill="rgba(148,163,184,0.5)" />
      <circle cx="122" cy="73.5" r="3" fill="rgba(148,163,184,0.5)" />
    </svg>
  );
}

function StatCard({
  icon: Icon,
  value,
  caption,
  tint,
}: {
  icon: typeof Bot;
  value: string;
  caption: string;
  tint: string;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Card className="gap-0 rounded-xl py-5">
        <CardContent className="flex items-center gap-4 px-5">
          <span aria-hidden="true" className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${tint}`}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none text-foreground">{value}</p>
            <p className="mt-1.5 truncate text-xs text-muted-foreground">{caption}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardView() {
  const setView = useCortexStore((s) => s.setView);
  const openAgent = useCortexStore((s) => s.openAgent);
  const openConversation = useCortexStore((s) => s.openConversation);
  const activeWorkspaceId = useCortexStore((s) => s.activeWorkspaceId);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["dashboard", activeWorkspaceId],
    queryFn: () => api.getDashboard(activeWorkspaceId ?? undefined),
    enabled: !!activeWorkspaceId,
  });

  useErrorToast(isError ? error : null);

  if (isPending) return <DashboardSkeleton />;

  if (isError || !data) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "دریافت اطلاعات داشبورد ناموفق بود."}
        onRetry={() => void refetch()}
      />
    );
  }

  const { stats, recentAgents, recentConversations, activity = [] } = data;
  const hasAgents = stats.agents > 0;

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[28px] border border-white/[.07] bg-[radial-gradient(circle_at_75%_15%,rgba(59,130,255,.13),transparent_25%),radial-gradient(circle_at_20%_80%,rgba(139,92,246,.10),transparent_22%),linear-gradient(145deg,#0f141d,#080b10)] px-5 py-6 sm:px-8">
        <div className="relative z-10 grid items-center gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <div className="max-w-xl">
            <p className="cortex-kicker">INTELLIGENCE OPERATING SYSTEM</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Cortex را مثل یک سیستم زنده بساز.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">از دانش واقعی کسب‌وکار تا پاسخ‌گویی، تلگرام و تحلیل استفاده؛ همه‌چیز حول یک هسته‌ی قابل کنترل و قابل توسعه.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs text-primary">RAG واقعی</span><span className="rounded-full border border-violet-400/15 bg-violet-400/5 px-3 py-1.5 text-xs text-violet-300">Provider مستقل</span><span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs text-slate-300">Multi-tenant</span>
            </div>
          </div>
          <CortexCore/>
        </div>
      </section>
      {/* Stats */}
      <section aria-label="آمار کلی" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          icon={Bot}
          value={faNum(stats.activeAgents)}
          caption={`از مجموع ${faNum(stats.agents)} ایجنت فعال`}
          tint="border-primary/25 bg-primary/10 text-primary"
        />
        <StatCard
          icon={Library}
          value={faNum(stats.knowledgeSources)}
          caption={`${faNum(stats.knowledgeReady)} منبع آماده استفاده`}
          tint="border-secondary/25 bg-secondary/10 text-secondary"
        />
        <StatCard
          icon={MessagesSquare}
          value={faNum(stats.conversations)}
          caption="مجموع گفتگوها"
          tint="border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
        />
        <StatCard
          icon={MessageSquare}
          value={faNum(stats.messages)}
          caption="پیام‌های رد و بدل شده"
          tint="border-amber-500/25 bg-amber-500/10 text-amber-400"
        />
      </section>

      <section aria-label="عملیات سریع و فعالیت اخیر" className="grid items-start gap-5 xl:grid-cols-[1.18fr_.82fr]">
        <Card className="cortex-panel overflow-hidden rounded-2xl">
          <CardHeader className="border-b border-white/[.06]">
            <div>
              <p className="cortex-kicker">QUICK ACTIONS</p>
              <CardTitle className="mt-2 text-base">از این‌جا شروع کنید</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">عملیات مستقیم روی همین فضای کاری</p>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            {[
              {
                title: "ایجنت جدید",
                description: "یک ایجنت با رفتار و لحن دلخواه بسازید.",
                icon: Bot,
                view: "agent-new" as const,
              },
              {
                title: "افزودن دانش",
                description: "فایل یا وب‌سایت واقعی را به دانش متصل کنید.",
                icon: BookPlus,
                view: "knowledge" as const,
              },
              {
                title: "گفتگوها",
                description: "آخرین مکالمات ایجنت‌ها را بررسی کنید.",
                icon: MessagesSquare,
                view: "conversations" as const,
              },
              {
                title: "اتصال تلگرام",
                description: "یک Bot را به ایجنت این فضا متصل کنید.",
                icon: Send,
                view: "telegram" as const,
              },
            ].map((action) => (
              <button
                key={action.title}
                type="button"
                onClick={() => setView(action.view)}
                className="cortex-action group relative flex min-h-[116px] flex-col justify-between rounded-2xl border border-white/[.07] bg-white/[.02] p-4 text-start"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                    <action.icon className="size-[18px]" />
                  </span>
                  <ArrowUpLeft className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1" />
                </div>
                <div className="relative z-10 mt-5">
                  <p className="text-sm font-semibold">{action.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.description}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="cortex-panel overflow-hidden rounded-2xl">
          <CardHeader className="border-b border-white/[.06]">
            <div>
              <p className="cortex-kicker">SYSTEM ACTIVITY</p>
              <CardTitle className="mt-2 text-base">آخرین فعالیت‌ها</CardTitle>
            </div>
            <div className="flex size-9 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/10 text-emerald-400">
              <Activity className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {activity.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm font-medium">هنوز رخدادی ثبت نشده است.</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">ساخت ایجنت، آپلود دانش و گفتگوها در این بخش دیده می‌شوند.</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[.06]">
                {activity.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[.07] bg-white/[.025]">
                      <Activity className="size-3.5 text-primary" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.action}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{item.entityType} · {timeAgoFa(item.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {!hasAgents ? (
        <EmptyState
          icon={<DashboardEmptyIllustration />}
          title="هنوز ایجنتی نساخته‌اید"
          description="اولین ایجنت خود را بسازید، دانش سازمان‌تان را به آن آموزش دهید و در چند دقیقه پاسخ‌گوی مشتریان باشید."
          action={
            <Button onClick={() => setView("agent-new")}>
              <Plus />
              ایجاد ایجنت
            </Button>
          }
          className="bg-card py-16"
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {/* Recent agents */}
          <Card className="rounded-xl">
            <CardHeader className="border-b [.border-b]:pb-4">
              <CardTitle className="text-base">ایجنت‌های اخیر</CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm" className="text-primary" onClick={() => setView("agents")}>
                  مشاهده همه
                  <ChevronLeft aria-hidden="true" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-2">
              {recentAgents.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">هنوز ایجنتی وجود ندارد.</p>
              ) : (
                <ul className="divide-y">
                  {recentAgents.slice(0, 5).map((agent) => (
                    <li key={agent.id}>
                      <button
                        type="button"
                        onClick={() => openAgent(agent.id)}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-start transition-colors hover:bg-accent"
                      >
                        <span
                          aria-hidden="true"
                          className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-primary"
                        >
                          <Bot className="size-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{agent.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            آخرین به‌روزرسانی {timeAgoFa(agent.updatedAt)}
                          </span>
                        </span>
                        <ChevronLeft aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent conversations */}
          <Card className="rounded-xl">
            <CardHeader className="border-b [.border-b]:pb-4">
              <CardTitle className="text-base">گفتگوهای اخیر</CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm" className="text-primary" onClick={() => setView("conversations")}>
                  مشاهده همه
                  <ChevronLeft aria-hidden="true" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-2">
              {recentConversations.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">هنوز گفتگویی ثبت نشده است.</p>
              ) : (
                <ul className="divide-y">
                  {recentConversations.slice(0, 5).map((conversation) => (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        onClick={() => openConversation(conversation.agentId, conversation.id)}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-start transition-colors hover:bg-accent"
                      >
                        <span
                          aria-hidden="true"
                          className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-secondary"
                        >
                          <MessageSquare className="size-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{conversation.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {conversation.agentName} · {timeAgoFa(conversation.updatedAt)}
                          </span>
                        </span>
                        <ChevronLeft aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
