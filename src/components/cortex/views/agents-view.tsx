"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, Bot, BrainCircuit, FileText, MessageCircle, Plus, Search, Sparkles, SlidersHorizontal, UsersRound } from "lucide-react";

import { api } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { EmptyState, ErrorState, useErrorToast } from "@/components/cortex/bits";
import { faNum, languageLabel, timeAgoFa, toneLabel } from "@/components/cortex/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function AgentsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
    </div>
  );
}

function SummaryCard({ icon: Icon, value, label, detail, tint }: { icon: typeof Bot; value: string; label: string; detail: string; tint: string }) {
  return (
    <Card className="cortex-panel rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <span className={cn("flex size-10 items-center justify-center rounded-xl border", tint)}><Icon className="size-[18px]" /></span>
          <span className="text-[10px] text-muted-foreground">{detail}</span>
        </div>
        <p className="mt-5 text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export function AgentsView() {
  const openAgent = useCortexStore((s) => s.openAgent);
  const setView = useCortexStore((s) => s.setView);
  const activeWorkspaceId = useCortexStore((s) => s.activeWorkspaceId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active">("all");
  const [sort, setSort] = useState<"updated" | "created" | "name">("updated");

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["agents", activeWorkspaceId],
    queryFn: () => api.getAgents(activeWorkspaceId ?? undefined),
    enabled: !!activeWorkspaceId,
  });

  useErrorToast(isError ? error : null);

  const agents = data?.agents ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return agents
      .filter((agent) => filter === "all" || agent.status === "active")
      .filter((agent) => !q || [agent.name, agent.orgName, agent.description, agent.persona, agent.tone].filter(Boolean).join(" ").toLocaleLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name, "fa");
        const ak = sort === "created" ? a.createdAt : a.updatedAt;
        const bk = sort === "created" ? b.createdAt : b.updatedAt;
        return new Date(bk).getTime() - new Date(ak).getTime();
      });
  }, [agents, filter, search, sort]);

  if (isPending) return <AgentsSkeleton />;
  if (isError || !data) {
    return <ErrorState message={error instanceof Error ? error.message : "دریافت فهرست ایجنت‌ها ناموفق بود."} onRetry={() => void refetch()} />;
  }

  const knowledgeTotal = agents.reduce((n, a) => n + a._count.knowledgeSources, 0);
  const conversationTotal = agents.reduce((n, a) => n + a._count.conversations, 0);
  const active = agents.filter((a) => a.status === "active").length;
  const personalized = agents.filter((a) => a.persona?.trim() || a.systemPrompt?.trim()).length;

  return (
    <div className="space-y-7">
      <section className="cortex-panel relative overflow-hidden rounded-[28px] p-5 sm:p-7">
        <div className="absolute -end-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -start-16 -bottom-20 size-56 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="cortex-kicker">استودیو ایجنت</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">ایجنت‌هایت را مثل یک محصول بساز.</h2>
            <p className="mt-3 text-sm leading-8 text-muted-foreground">هویت، شخصیت، دانش، حافظه و رفتار هر ایجنت مستقل است؛ از همین‌جا بساز، تنظیم کن و وارد پلی‌گراند شو.</p>
          </div>
          <Button className="shrink-0" onClick={() => setView("agent-new")}><Plus />ساخت ایجنت جدید</Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard icon={Bot} value={faNum(agents.length)} label="کل ایجنت‌ها" detail="در این فضا" tint="border-primary/20 bg-primary/10 text-primary" />
        <SummaryCard icon={Activity} value={faNum(active)} label="ایجنت فعال" detail="قابل استفاده" tint="border-emerald-400/20 bg-emerald-400/10 text-emerald-300" />
        <SummaryCard icon={FileText} value={faNum(knowledgeTotal)} label="منابع دانش" detail="متصل" tint="border-violet-400/20 bg-violet-400/10 text-violet-300" />
        <SummaryCard icon={Sparkles} value={faNum(personalized)} label="شخصی‌سازی‌شده" detail="شخصیت / سیستم" tint="border-amber-400/20 bg-amber-400/10 text-amber-300" />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-white/[.07] bg-white/[.018] p-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجوی نام، سازمان، توضیحات یا شخصیت ایجنت..." className="h-11 border-white/[.08] bg-black/10 ps-10" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}><UsersRound />همه</Button>
          <Button variant={filter === "active" ? "default" : "outline"} size="sm" onClick={() => setFilter("active")}><Activity />فعال</Button>
          <Button variant="outline" size="sm" onClick={() => setSort(sort === "updated" ? "created" : sort === "created" ? "name" : "updated")}><SlidersHorizontal />{sort === "updated" ? "آخرین تغییر" : sort === "created" ? "جدیدترین" : "نام"}</Button>
        </div>
      </section>

      {agents.length === 0 ? (
        <EmptyState
          icon={<span className="flex size-14 items-center justify-center rounded-2xl border bg-muted text-primary"><BrainCircuit className="size-7" /></span>}
          title="هنوز ایجنتی نساخته‌اید"
          description="اولین ایجنت خود را بسازید، شخصیت و رفتار آن را تنظیم کنید و بعد دانش واقعی را به آن متصل کنید."
          action={<Button onClick={() => setView("agent-new")}><Plus />ایجاد ایجنت</Button>}
          className="bg-card"
        />
      ) : filtered.length === 0 ? (
        <Card className="cortex-panel rounded-2xl"><CardContent className="py-16 text-center"><Search className="mx-auto size-8 text-muted-foreground/50" /><p className="mt-4 text-sm font-semibold">نتیجه‌ای پیدا نشد</p><p className="mt-1 text-xs text-muted-foreground">عبارت جست‌وجو یا فیلتر را تغییر دهید.</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((agent, index) => {
            const personalizedAgent = Boolean(agent.persona?.trim() || agent.systemPrompt?.trim());
            const knowledge = agent._count.knowledgeSources;
            const conversations = agent._count.conversations;
            return (
              <motion.div key={agent.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18, delay: Math.min(index * .025, .18) }} whileHover={{ y: -4 }} className="h-full">
                <button type="button" onClick={() => openAgent(agent.id)} aria-label={`مشاهده ایجنت ${agent.name}`} className="group h-full w-full text-start">
                  <Card className="cortex-panel h-full min-h-[250px] overflow-hidden rounded-2xl transition-colors group-hover:border-primary/30">
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_26px_rgba(59,130,255,.08)]"><Bot className="size-5" /></span>
                          <div className="min-w-0"><p className="truncate font-semibold">{agent.name}</p><p className="truncate text-xs text-muted-foreground">{agent.orgName || "ایجنت مستقل"}</p></div>
                        </div>
                        <span className={cn("mt-1 size-2.5 rounded-full", agent.status === "active" ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.7)]" : "bg-muted-foreground")} title={agent.status === "active" ? "فعال" : agent.status} />
                      </div>

                      <p className="line-clamp-3 min-h-[66px] text-sm leading-7 text-muted-foreground">{agent.description || agent.persona || "هنوز توضیحات اختصاصی برای این ایجنت ثبت نشده است."}</p>

                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="font-normal">{languageLabel(agent.language)}</Badge>
                        <Badge variant="outline" className="font-normal text-muted-foreground">{toneLabel(agent.tone, agent.customTone)}</Badge>
                        {personalizedAgent && <Badge variant="outline" className="border-violet-400/20 bg-violet-400/5 font-normal text-violet-300">شخصیت تنظیم شده</Badge>}
                      </div>

                      <div className="mt-auto grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3"><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="size-3.5" />دانش</div><p className="mt-1.5 text-sm font-semibold">{faNum(knowledge)}</p></div>
                        <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3"><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><MessageCircle className="size-3.5" />گفتگو</div><p className="mt-1.5 text-sm font-semibold">{faNum(conversations)}</p></div>
                        <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3"><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="size-3.5" />حافظه</div><p className="mt-1.5 text-sm font-semibold">{agent.memoryEnabled ? "روشن" : "خاموش"}</p></div>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/[.06] pt-3 text-[10px] text-muted-foreground">
                        <span>آخرین تغییر {timeAgoFa(agent.updatedAt)}</span>
                        <span className="text-primary transition-transform group-hover:-translate-x-1">ورود به ایجنت ←</span>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {agents.length > 0 && <p className="text-center text-[11px] text-muted-foreground">{faNum(conversationTotal)} گفتگوی ثبت‌شده در این فضای کاری</p>}
    </div>
  );
}
