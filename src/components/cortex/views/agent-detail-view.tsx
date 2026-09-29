"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileText,
  Library,
  MessageSquare,
  MessagesSquare,
  Pencil,
  Trash2,
  Wrench,
  Check,
  KeyRound,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Play,
  Loader2,
  Activity,
  CircleDollarSign,
  Users,
  MessageCircleQuestion,
} from "lucide-react";
import { toast } from "sonner";

import { api, type TelegramBotDto } from "@/lib/cortex-client";
import { useCortexStore, type AgentTab } from "@/components/cortex/store";
import { ErrorState, useErrorToast } from "@/components/cortex/bits";
import { faNum, languageLabel, timeAgoFa, toneLabel } from "@/components/cortex/format";
import { KnowledgeManager, useAgentKnowledge } from "@/components/cortex/knowledge";
import { Playground } from "@/components/cortex/playground";
import { AgentForm } from "@/components/cortex/views/agent-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentApiAccess } from "@/components/cortex/agent-api-access";
import { TelegramAccessManager, TelegramCustomizer } from "@/components/cortex/views/telegram-view";

const AGENT_TABS: Array<{ value: AgentTab; label: string }> = [
  { value: "overview", label: "نمای کلی" },
  { value: "knowledge", label: "دانش" },
  { value: "telegram", label: "تلگرام" },
  { value: "ai", label: "مدل و هوش مصنوعی" },
  { value: "tools", label: "ابزارها" },
  { value: "playground", label: "پلی‌گراند" },
  { value: "api", label: "API" },
  { value: "analytics", label: "تحلیل" },
  { value: "settings", label: "تنظیمات" },
];

function DeleteAgentDialog({
  agentId,
  open,
  onOpenChange,
}: {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setView = useCortexStore((s) => s.setView);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteAgent(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["conversations-all"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-all"] });
      queryClient.removeQueries({ queryKey: ["agent", agentId] });
      queryClient.removeQueries({ queryKey: ["knowledge", agentId] });
      queryClient.removeQueries({ queryKey: ["conversations", agentId] });
      toast.success("ایجنت حذف شد");
      onOpenChange(false);
      setView("agents");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف ایجنت</AlertDialogTitle>
          <AlertDialogDescription>
            حذف ایجنت همراه با همه منابع دانش و تاریخچه گفتگوها غیرقابل بازگشت است. آیا مطمئن هستید؟
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>انصراف</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={deleteMutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              deleteMutation.mutate();
            }}
          >
            {deleteMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
            حذف قطعی
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MiniStat({ icon: Icon, value, label, tint }: { icon: typeof FileText; value: string; label: string; tint: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${tint}`}>
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none text-foreground">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function OverviewTab({ agentId }: { agentId: string }) {
  const setAgentTab = useCortexStore((s) => s.setAgentTab);
  const openConversation = useCortexStore((s) => s.openConversation);

  const { data: agentData } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => api.getAgent(agentId),
  });
  const { data: knowledgeData } = useAgentKnowledge(agentId);
  const { data: conversationsData, isPending: conversationsPending } = useQuery({
    queryKey: ["conversations", agentId],
    queryFn: () => api.getConversations(agentId),
  });

  const agent = agentData?.agent;
  const sources = knowledgeData?.sources;
  const readyCount = sources?.filter((s) => s.status === "ready").length;
  const conversations = (conversationsData?.conversations ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader className="border-b [.border-b]:pb-4">
            <CardTitle className="text-base">درباره ایجنت</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm leading-[1.9] text-muted-foreground">
              {agent?.description?.trim() || "توضیحی برای این ایجنت ثبت نشده است."}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="border-b [.border-b]:pb-4">
            <CardTitle className="text-base">دانش</CardTitle>
            <CardDescription>منابعی که ایجنت از آن‌ها پاسخ می‌سازد.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {sources === undefined ? (
                "در حال دریافت…"
              ) : sources.length === 0 ? (
                "هنوز منبعی اضافه نشده است."
              ) : (
                <>
                  {faNum(sources.length)} منبع · {faNum(readyCount ?? 0)} آماده استفاده
                </>
              )}
            </p>
            <Button variant="outline" size="sm" onClick={() => setAgentTab("knowledge")}>
              <Library />
              مدیریت دانش
            </Button>
          </CardContent>
        </Card>
      </div>

      <BusinessOnboardingCard agentId={agentId} />

      {agent?.instructions?.trim() && (
        <Card className="rounded-xl">
          <CardHeader className="border-b [.border-b]:pb-4">
            <CardTitle className="text-base">دستورالعمل‌ها</CardTitle>
            <CardDescription>قواعد رفتار و پاسخ‌دهی ایجنت.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <p dir="auto" className="whitespace-pre-wrap text-sm leading-[1.9] text-muted-foreground">
              {agent.instructions}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl">
        <CardHeader className="border-b [.border-b]:pb-4">
          <CardTitle className="text-base">گفتگوهای اخیر</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {conversationsPending ? (
            <div className="space-y-3 pt-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              هنوز گفتگویی با این ایجنت انجام نشده است.
            </p>
          ) : (
            <ul className="divide-y">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => openConversation(agentId, conversation.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-start transition-colors hover:bg-accent"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-primary"
                    >
                      <MessageSquare className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{conversation.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {faNum(conversation.messageCount)} پیام · {timeAgoFa(conversation.updatedAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function BusinessOnboardingCard({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState("");
  const onboardingQ = useQuery({
    queryKey: ["business-onboarding", agentId],
    queryFn: () => api.getBusinessOnboarding(agentId),
  });
  const session = onboardingQ.data?.session ?? null;

  const start = useMutation({
    mutationFn: (mode: "quick" | "full") => api.startBusinessOnboarding(agentId, mode),
    onSuccess: ({ session: next }) => {
      queryClient.setQueryData(["business-onboarding", agentId], (prev: any) => ({ ...(prev ?? {}), session: next }));
      setAnswer("");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const sendAnswer = useMutation({
    mutationFn: () => api.answerBusinessOnboarding(agentId, session?.id ?? "", answer.trim()),
    onSuccess: ({ session: next }) => {
      queryClient.setQueryData(["business-onboarding", agentId], (prev: any) => ({ ...(prev ?? {}), session: next }));
      setAnswer("");
      if (next.status === "completed") {
        queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
        queryClient.invalidateQueries({ queryKey: ["knowledge", agentId] });
        queryClient.invalidateQueries({ queryKey: ["knowledge-all"] });
        toast.success("پروفایل دانشی کسب‌وکار ساخته و برای ایجنت آماده شد.");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const active = session?.status === "active" && session.question;
  const result = session?.status === "completed" ? session.result : null;
  const total = Math.max(1, session?.totalQuestions ?? 30);
  const current = Math.min(total, session?.currentIndex ?? 0);
  const progress = Math.round((current / total) * 100);

  return (
    <Card className="cortex-panel overflow-hidden rounded-[22px] border-primary/15 bg-primary/[.025]">
      <CardHeader className="border-b border-white/[.06] pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="cortex-icon-box"><Sparkles className="size-4" /></span>
              راه‌اندازی هوشمند کسب‌وکار
            </CardTitle>
            <CardDescription className="mt-2 leading-6">
              کاملاً اختیاری؛ Cortex از پاسخ‌ها پروفایل کسب‌وکار، قوانین پاسخ‌گویی، خدمات و FAQ می‌سازد.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 text-primary">اختیاری</Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        {onboardingQ.isPending ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />در حال آماده‌سازی…</div>
        ) : active ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>سؤال {faNum((session?.currentIndex ?? 0) + 1)} از {faNum(total)}</span>
              <span>{faNum(progress)}٪ تکمیل</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/70">
              <div className="h-full rounded-full bg-gradient-to-r from-primary via-sky-400 to-violet-400 transition-all duration-500" style={{ width: progress + "%" }} />
            </div>
            <div className="rounded-2xl border border-primary/10 bg-background/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.03)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold tracking-[.18em] text-primary">{session?.question?.category}</p>
                <span className="rounded-full border border-border/70 px-2 py-1 text-[9px] text-muted-foreground">پاسخ آزاد</span>
              </div>
              <p className="mt-3 text-base font-bold leading-8">{session?.question?.question}</p>
            </div>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-border/80 bg-background px-4 py-3 text-sm leading-7 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="پاسخ را طبیعی و کامل بنویس؛ لازم نیست رسمی باشد…"
              aria-label="پاسخ سؤال راه‌اندازی"
            />
            {session?.error && <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-6 text-amber-200">{session.error}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => api.cancelBusinessOnboarding(agentId, session.id).then(() => onboardingQ.refetch())}>بعداً ادامه می‌دهم</Button>
              <Button onClick={() => sendAnswer.mutate()} disabled={sendAnswer.isPending || !answer.trim()} className="shadow-[0_10px_28px_rgba(59,130,246,.16)]">
                {sendAnswer.isPending ? <Loader2 className="animate-spin" /> : <ChevronRightIcon />}
                {sendAnswer.isPending ? "در حال پردازش…" : current + 1 === total ? "ساخت پروفایل" : "ثبت و سؤال بعدی"}
              </Button>
            </div>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><CheckCircle2 className="size-4" />پروفایل کسب‌وکار آماده است</div>
            <p className="rounded-2xl border bg-background p-4 text-sm leading-7 text-muted-foreground">{result.businessSummary}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-background p-4"><p className="text-xs font-semibold">خدمات</p><p className="mt-2 text-xs leading-6 text-muted-foreground">{(result.services ?? []).slice(0, 6).join("، ") || "—"}</p></div>
              <div className="rounded-2xl border bg-background p-4"><p className="text-xs font-semibold">مخاطب هدف</p><p className="mt-2 text-xs leading-6 text-muted-foreground">{(result.targetAudience ?? []).slice(0, 4).join("، ") || "—"}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => start.mutate("quick")} disabled={start.isPending}><Sparkles />اجرای نسخه سریع</Button>
              <Button variant="outline" onClick={() => start.mutate("full")} disabled={start.isPending}>اجرای مصاحبه کامل</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1.1fr_.9fr]">
            <div className="rounded-2xl border border-white/[.07] bg-white/[.018] p-5">
              <p className="text-sm font-semibold">بدون اجبار، با دو مسیر متفاوت</p>
              <p className="mt-2 text-xs leading-7 text-muted-foreground">نسخه سریع برای شروع فوری است و نسخه کامل برای استخراج دقیق‌تر سیاست‌ها، خدمات، مشتری، فروش و پشتیبانی.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => start.mutate("quick")} disabled={start.isPending}><Sparkles />شروع سریع · ۸ سؤال</Button>
                <Button variant="outline" onClick={() => start.mutate("full")} disabled={start.isPending}>شروع کامل · ۳۰ سؤال</Button>
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-white/[.10] bg-background/50 p-5">
              <p className="text-xs font-semibold text-muted-foreground">فعلاً آماده‌سازی نکن</p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">می‌توانی فعلاً از این مرحله عبور کنی، بعداً از همین صفحه مصاحبه را شروع کنی.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChevronRightIcon() {
  return <ArrowRight className="rotate-180" />;
}

function ToolsTab({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["agent-tools", agentId], queryFn: () => api.getAgentTools(agentId) });
  const mutation = useMutation({
    mutationFn: (input: { toolId: string; enabled: boolean }) => api.setAgentTool(agentId, input.toolId, input.enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-tools", agentId] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const removeMutation = useMutation({
    mutationFn: (toolId: string) => api.removeAgentTool(agentId, toolId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-tools", agentId] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const tools = data?.tools ?? [];
  const { data: executionData } = useQuery({ queryKey: ["executions", agentId], queryFn: () => api.getExecutions(undefined, agentId) });
  const executions = executionData?.executions ?? [];
  return <div className="space-y-4">
    <Card className="rounded-xl">
      <CardHeader className="border-b [.border-b]:pb-4"><CardTitle className="text-base">ابزارهای Agent Runtime</CardTitle><CardDescription>این ابزارها واقعاً هنگام اجرای ایجنت قابل فراخوانی هستند؛ صرفاً ظاهر UI نیستند.</CardDescription></CardHeader>
      <CardContent className="space-y-3 pt-4">
        {isPending ? <Skeleton className="h-20 rounded-xl" /> : tools.map(tool => <div key={tool.id} className="flex items-center gap-3 rounded-xl border p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary"><Wrench className="size-4" /></span>
          <div className="min-w-0 flex-1"><p className="font-medium">{tool.name}</p><p className="mt-1 text-xs text-muted-foreground">{tool.key} · {tool.description}</p></div>
          {tool.attached ? <Button variant="outline" size="sm" onClick={() => removeMutation.mutate(tool.id)} disabled={removeMutation.isPending}>حذف از Agent</Button> : <Button size="sm" onClick={() => mutation.mutate({toolId:tool.id,enabled:true})} disabled={mutation.isPending}><Check /> فعال‌سازی</Button>}
        </div>)}
        {!isPending && tools.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">ابزار فعالی ثبت نشده است.</p>}
      </CardContent>
    </Card>
    <Card className="rounded-xl">
      <CardHeader className="border-b [.border-b]:pb-4"><CardTitle className="text-base">Execution History</CardTitle><CardDescription>اجرای واقعی Agent، مرحله‌به‌مرحله ثبت می‌شود.</CardDescription></CardHeader>
      <CardContent className="space-y-3 pt-4">
        {executions.slice(0, 8).map(ex => <div key={ex.id} className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{ex.status}</p><p className="text-xs text-muted-foreground">{new Date(ex.startedAt).toLocaleString("fa-IR")}</p></div><Badge variant="outline">{ex.triggerType}</Badge></div><div className="mt-3 flex flex-wrap gap-2">{ex.steps.map(s => <Badge key={s.id} variant="secondary">{s.seq}. {s.name}</Badge>)}</div>{ex.output && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{ex.output}</p>}</div>)}
        {executions.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">هنوز Executionای ثبت نشده است. یک پیام در Playground بفرستید.</p>}
      </CardContent>
    </Card>
  </div>;
}


function ManagedModelTab({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const setView = useCortexStore((s) => s.setView);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["billing", "model-picker"],
    queryFn: () => api.getBilling(),
    staleTime: 20_000,
  });
  const agentQuery = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => api.getAgent(agentId),
    staleTime: 30_000,
  });

  const selectModel = useMutation({
    mutationFn: (modelKey: string) => api.updateAgent(agentId, { modelKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
      queryClient.invalidateQueries({ queryKey: ["billing", "model-picker"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("مدل Agent به‌روزرسانی شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || agentQuery.isPending) {
    return <div className="space-y-4"><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>;
  }
  if (isError || !data || agentQuery.isError || !agentQuery.data) {
    return <ErrorState message={error instanceof Error ? error.message : "دریافت مدل‌های Cortex ناموفق بود."} onRetry={() => { void refetch(); void agentQuery.refetch(); }} />;
  }

  const plan = data.account.plan;
  const currentModel = agentQuery.data.agent.modelKey ?? "launch-fast";
  const models = data.models ?? [];
  const grouped = ["economy", "balanced", "premium", "deep"].map((tier) => ({
    tier,
    items: models.filter((item) => item.qualityTier === tier),
  })).filter((group) => group.items.length > 0);

  const labels: Record<string, { title: string; description: string }> = {
    economy: { title: "سریع و اقتصادی", description: "برای پاسخ‌های روزمره با مصرف کنترل‌شده" },
    balanced: { title: "حرفه‌ای", description: "تعادل کیفیت، سرعت و هزینه" },
    premium: { title: "متخصص", description: "برای کارهای پیچیده‌تر و تحلیل عمیق‌تر" },
    deep: { title: "پیشرفته", description: "مدل‌های قدرتمند برای سناریوهای سازمانی" },
  };

  function upgrade() {
    setView("billing");
  }

  return (
    <div className="space-y-5">
      <Card className="cortex-panel overflow-hidden rounded-2xl">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="cortex-kicker">CORTEX MODEL ROUTER</p>
              <h3 className="mt-2 text-xl font-black">مدل را انتخاب کن؛ اتصال را Cortex مدیریت می‌کند.</h3>
              <p className="mt-2 max-w-2xl text-xs leading-6 text-muted-foreground">
                هیچ Provider، API Key یا Base URL لازم نیست. مدل انتخابی بر اساس پلن شما از زیرساخت Cortex اجرا می‌شود و هزینه آن از اعتبار کم می‌شود.
              </p>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-primary/[.05] px-4 py-3 text-start">
              <p className="text-[10px] text-muted-foreground">پلن فعلی</p>
              <p className="mt-1 text-sm font-black text-primary">{plan.name}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/[.04] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold">اعتبار باقی‌مانده</p>
                <p className="mt-1 text-lg font-black">{faNum(data.account.balanceCredits)} <span className="text-[10px] font-medium text-muted-foreground">اعتبار</span></p>
              </div>
              <div className="min-w-[180px] flex-1 sm:max-w-sm">
                <div className="flex justify-between text-[9px] text-muted-foreground"><span>پیشرفت مصرف</span><span>{faNum(plan.monthlyCredits ? Math.min(100, Math.round((data.account.balanceCredits / plan.monthlyCredits) * 100)) : 0)}٪</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: (plan.monthlyCredits ? Math.min(100, Math.max(0, Math.round((data.account.balanceCredits / plan.monthlyCredits) * 100))) : 0) + "%" }} /></div>
              </div>
              <Button onClick={upgrade} variant="outline">مدیریت پلن و اعتبار</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {grouped.map((group) => (
        <section key={group.tier} className="space-y-3">
          <div>
            <h4 className="text-sm font-black">{labels[group.tier]?.title ?? group.tier}</h4>
            <p className="mt-1 text-[10px] text-muted-foreground">{labels[group.tier]?.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((model) => {
              const selected = model.key === currentModel || model.modelId === currentModel || model.id === currentModel;
              const allowed = model.enabledForPlan;
              return (
                <button
                  key={model.id}
                  type="button"
                  disabled={!allowed || selectModel.isPending}
                  onClick={() => allowed && selectModel.mutate(model.key ?? model.modelId)}
                  className={cn(
                    "rounded-2xl border p-4 text-start transition-all",
                    selected ? "border-primary/40 bg-primary/[.08] shadow-[0_12px_34px_rgba(59,130,255,.10)]" : "border-border/70 bg-card/55 hover:border-primary/25",
                    !allowed && "cursor-not-allowed opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{model.displayName}</p>
                      <p className="mt-1 text-[10px] leading-5 text-muted-foreground">{allowed ? "فعال برای پلن شما" : "با ارتقا باز می‌شود"}</p>
                    </div>
                    <Badge variant={selected ? "default" : "outline"}>{selected ? "انتخاب‌شده" : allowed ? "مجاز" : "قفل"}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[9px] text-muted-foreground">
                    <span>{faNum(model.creditMultiplierBps / 100)}× ضریب کیفیت</span>
                    <span>{model.vision ? "Vision" : "Text"} · {model.tools ? "Tools" : "Basic"}</span>
                  </div>
                  {!allowed && <div className="mt-3 rounded-xl border border-primary/15 bg-primary/[.04] px-3 py-2 text-[9px] text-primary">برای دسترسی به این سطح، به پلن بالاتر برو.</div>}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <Card className="rounded-2xl border-emerald-400/15 bg-emerald-400/[.035]">
        <CardContent className="p-4">
          <p className="text-xs font-semibold">کنترل هزینه بدون دردسر</p>
          <p className="mt-1 text-[10px] leading-5 text-muted-foreground">قبل از هر درخواست، Cortex اعتبار لازم را رزرو می‌کند. بعد از پاسخ، مصرف واقعی ثبت و از Wallet کسر می‌شود. هیچ کلید API در اختیار کاربر قرار نمی‌گیرد.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentTelegramTab({ agentId }: { agentId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ["telegram-bots", "agent", agentId],
    queryFn: () => api.getTelegramBots(),
  });
  const bots = (data?.bots ?? []).filter((bot) => bot.agentId === agentId);

  if (isPending) {
    return <div className="space-y-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>;
  }

  if (bots.length === 0) {
    return (
      <Card className="rounded-2xl border-primary/15 bg-primary/[.025]">
        <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary"><ShieldCheck className="size-5" /></span>
          <div>
            <p className="text-sm font-semibold">هنوز ربات تلگرامی به این ایجنت متصل نیست.</p>
            <p className="mt-1 max-w-md text-xs leading-6 text-muted-foreground">اتصال و ساخت ربات را از بخش تلگرام انجام بده. بعد از اتصال، شخصی‌سازی، دسترسی کاربران و مانیتورینگ مصرف همین‌جا در دسترس است.</p>
          </div>
          <Button variant="outline" onClick={() => useCortexStore.getState().setView("telegram")}>ساخت یا اتصال ربات</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {bots.map((bot: TelegramBotDto) => (
        <Card key={bot.id} className="overflow-hidden rounded-2xl">
          <CardHeader className="border-b border-white/[.06] pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="flex size-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary"><ShieldCheck className="size-4" /></span>
                  <span className="truncate">{bot.name}</span>
                </CardTitle>
                <CardDescription className="mt-1">{bot.username ? "@" + bot.username : "بدون username"} · {bot.status === "connected" ? "متصل" : bot.status}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => useCortexStore.getState().setView("telegram")}>مدیریت اتصال</Button>
                <Button
                  size="sm"
                  onClick={() => document.getElementById(`telegram-bot-customizer-${bot.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  شخصی‌سازی Bot
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => document.getElementById(`telegram-bot-access-${bot.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="rounded-xl border border-primary/15 bg-primary/[.04] p-3 text-start transition hover:border-primary/30"
              >
                <p className="text-xs font-semibold text-foreground">افزودن شماره و مدیریت دسترسی</p>
                <p className="mt-1 text-[10px] leading-5 text-muted-foreground">ثبت شماره، ساخت لینک ورود و تعیین سقف مصرف کاربران.</p>
              </button>
              <button
                type="button"
                onClick={() => document.getElementById(`telegram-bot-customizer-${bot.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="rounded-xl border border-violet-400/15 bg-violet-400/[.04] p-3 text-start transition hover:border-violet-400/30"
              >
                <p className="text-xs font-semibold text-foreground">تیون و شخصی‌سازی ربات</p>
                <p className="mt-1 text-[10px] leading-5 text-muted-foreground">Welcome، Help، دکمه‌ها، Commandها، پیام‌های وضعیت و بنر.</p>
              </button>
            </div>
            <TelegramCustomizer botId={bot.id} />
            <TelegramAccessManager botId={bot.id} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}



function AgentAnalyticsTab({ agentId }: { agentId: string }) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["agent-analytics", agentId],
    queryFn: () => api.getAgentAnalytics(agentId),
    staleTime: 30_000,
  });

  if (isPending) {
    return <div className="space-y-4"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>;
  }

  if (isError || !data) {
    return <ErrorState message={error instanceof Error ? error.message : "دریافت تحلیل ایجنت ناموفق بود."} onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat icon={MessagesSquare} value={faNum(data.conversations)} label="گفتگوها" tint="border-primary/25 bg-primary/10 text-primary" />
        <MiniStat icon={MessageCircleQuestion} value={faNum(data.usage.events)} label="درخواست‌های AI" tint="border-secondary/25 bg-secondary/10 text-secondary" />
        <MiniStat icon={Activity} value={faNum(data.usage.totalTokens)} label="توکن مصرف‌شده" tint="border-amber-500/25 bg-amber-500/10 text-amber-400" />
        <MiniStat icon={Users} value={faNum(data.telegramUsers)} label="کاربر تلگرام" tint="border-emerald-500/25 bg-emerald-500/10 text-emerald-400" />
      </div>

      <Card className="cortex-panel rounded-2xl">
        <CardHeader className="border-b border-white/[.06] pb-4">
          <CardTitle className="flex items-center gap-2 text-base"><CircleDollarSign className="size-4 text-primary" />مصرف و هزینه</CardTitle>
          <CardDescription>مصرف واقعی ثبت‌شده برای همین ایجنت، جدا از سایر ایجنت‌های فضای کاری.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">ورودی</p><p className="mt-1 text-lg font-bold">{faNum(data.usage.inputTokens)}</p><p className="text-[11px] text-muted-foreground">توکن</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">خروجی</p><p className="mt-1 text-lg font-bold">{faNum(data.usage.outputTokens)}</p><p className="text-[11px] text-muted-foreground">توکن</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">هزینه تخمینی</p><p className="mt-1 text-lg font-bold">{faNum(data.usage.estimatedCostMicros)}</p><p className="text-[11px] text-muted-foreground">میکرودلار</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">پرسش‌های بی‌پاسخ</p><p className="mt-1 text-lg font-bold">{faNum(data.unanswered)}</p><p className="text-[11px] text-muted-foreground">نیازمند بهبود دانش</p></div>
        </CardContent>
      </Card>

      <Card className="cortex-panel rounded-2xl">
        <CardHeader className="border-b border-white/[.06] pb-4">
          <CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4 text-primary" />روند ۱۴ روزه</CardTitle>
          <CardDescription>تعداد درخواست و توکن ثبت‌شده برای این Agent.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-end gap-1.5">
            {data.trend.map((item) => {
              const max = Math.max(...data.trend.map((point) => point.requests), 1);
              const height = Math.max(8, Math.round((item.requests / max) * 100));
              return (
                <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-36 w-full items-end"><div title={faNum(item.requests) + " درخواست"} className="mx-auto w-full max-w-9 rounded-t-xl bg-gradient-to-t from-primary/35 to-primary" style={{ height: height + "%" }} /></div>
                  <span className="text-[9px] text-muted-foreground">{item.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="cortex-panel rounded-2xl">
          <CardHeader className="border-b border-white/[.06] pb-4"><CardTitle className="text-base">پرسش‌های پرتکرار</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data.topQuestions.length === 0
              ? <p className="p-6 text-center text-sm text-muted-foreground">هنوز داده‌ای برای تحلیل وجود ندارد.</p>
              : <ul className="divide-y divide-white/[.06]">{data.topQuestions.slice(0, 8).map((item) => (
                <li key={item.question} className="flex items-start gap-3 p-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">{faNum(item.count)}</span>
                  <p className="text-sm leading-6">{item.question}</p>
                </li>
              ))}</ul>}
          </CardContent>
        </Card>

        <Card className="cortex-panel rounded-2xl">
          <CardHeader className="border-b border-white/[.06] pb-4">
            <CardTitle className="text-base">شکاف‌های دانش</CardTitle>
            <CardDescription>سؤال‌هایی که در پاسخ‌گویی دانش‌محور با fallback ثبت شده‌اند.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.unansweredQuestions.length === 0
              ? <p className="p-6 text-center text-sm text-muted-foreground">فعلاً شکاف شاخصی ثبت نشده است.</p>
              : <ul className="divide-y divide-white/[.06]">{data.unansweredQuestions.slice(0, 8).map((item) => (
                <li key={item.question} className="flex items-start gap-3 p-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-xs font-semibold text-amber-300">{faNum(item.count)}</span>
                  <p className="text-sm leading-6">{item.question}</p>
                </li>
              ))}</ul>}
          </CardContent>
        </Card>
      </div>

      <Card className="cortex-panel rounded-2xl">
        <CardHeader className="border-b border-white/[.06] pb-4">
          <CardTitle className="text-base">وضعیت دانش</CardTitle>
          <CardDescription>وضعیت منابع و onboarding همین Agent.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <MiniStat icon={Library} value={faNum(data.knowledge.sources)} label="کل منابع" tint="border-primary/25 bg-primary/10 text-primary" />
          <MiniStat icon={CheckCircle2} value={faNum(data.knowledge.ready)} label="منابع آماده" tint="border-emerald-500/25 bg-emerald-500/10 text-emerald-400" />
          <MiniStat icon={Sparkles} value={data.knowledge.onboardingComplete ? "آماده" : "ناقص"} label="پروفایل کسب‌وکار" tint="border-violet-500/25 bg-violet-500/10 text-violet-300" />
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsTab({ agentId }: { agentId: string }) {
  const { data } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => api.getAgent(agentId),
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="space-y-6">
      <AgentForm mode="edit" agent={data?.agent ?? null} />

      <Card className="rounded-xl border-destructive/30">
        <CardHeader className="border-b [.border-b]:pb-4">
          <CardTitle className="text-base text-destructive">منطقه خطر</CardTitle>
          <CardDescription>عملیات حساس و غیرقابل بازگشت.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start justify-between gap-4 pt-4 sm:flex-row sm:items-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            حذف ایجنت همراه با همه منابع دانش و تاریخچه گفتگوها غیرقابل بازگشت است.
          </p>
          <Button variant="destructive" className="shrink-0" onClick={() => setDeleteOpen(true)}>
            <Trash2 />
            حذف ایجنت
          </Button>
        </CardContent>
      </Card>

      <DeleteAgentDialog agentId={agentId} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

export function AgentDetailView() {
  const agentId = useCortexStore((s) => s.activeAgentId) as string;
  const agentTab = useCortexStore((s) => s.agentTab);
  const setAgentTab = useCortexStore((s) => s.setAgentTab);
  const setView = useCortexStore((s) => s.setView);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => api.getAgent(agentId),
  });

  useErrorToast(isError ? error : null);

  if (isPending) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-5 w-72" />
          </div>
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-[76px] rounded-xl" />
          <Skeleton className="h-[76px] rounded-xl" />
          <Skeleton className="h-[76px] rounded-xl" />
        </div>
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <ErrorState
          message={error instanceof Error ? error.message : "دریافت اطلاعات ایجنت ناموفق بود."}
          onRetry={() => void refetch()}
        />
        <Button variant="outline" onClick={() => setView("agents")}>
          <ArrowRight />
          بازگشت به ایجنت‌ها
        </Button>
      </div>
    );
  }

  const agent = data.agent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="truncate text-2xl font-bold tracking-tight text-foreground">{agent.name}</h2>
            {agent.status === "active" ? (
              <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-400" />
                فعال
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                {agent.status}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {agent.orgName && <span>{agent.orgName}</span>}
            {agent.orgName && <span aria-hidden="true">·</span>}
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {languageLabel(agent.language)}
            </Badge>
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {toneLabel(agent.tone, agent.customTone)}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setAgentTab("playground")}>
            <MessagesSquare />
            پلی‌گراند
          </Button>
          <Button variant="outline" onClick={() => setView("agent-edit")}>
            <Pencil />
            ویرایش
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 />
            حذف
          </Button>
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat
          icon={Library}
          value={faNum(agent._count.knowledgeSources)}
          label="منابع دانش"
          tint="border-primary/25 bg-primary/10 text-primary"
        />
        <MiniStat
          icon={MessagesSquare}
          value={faNum(agent._count.conversations)}
          label="گفتگوها"
          tint="border-secondary/25 bg-secondary/10 text-secondary"
        />
        <MiniStat
          icon={FileText}
          value={faNum(agent._count.messages)}
          label="پیام‌ها"
          tint="border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
        />
      </div>

      {/* Tabs */}
      <Tabs value={agentTab} onValueChange={(value) => setAgentTab(value as AgentTab)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
          {AGENT_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab agentId={agentId} />
        </TabsContent>
        <TabsContent value="knowledge" className="mt-6">
          <KnowledgeManager agentId={agentId} />
        </TabsContent>
        <TabsContent value="telegram" className="mt-6">
          <AgentTelegramTab agentId={agentId} />
        </TabsContent>
        <TabsContent value="ai" className="mt-6">
          <ManagedModelTab agentId={agentId} />
        </TabsContent>
        <TabsContent value="tools" className="mt-6">
          <ToolsTab agentId={agentId} />
        </TabsContent>
        <TabsContent value="playground" className="mt-4">
          <Playground agentId={agentId} />
        </TabsContent>
        <TabsContent value="api" className="mt-6">
          <AgentApiAccess agentId={agentId} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-6">
          <AgentAnalyticsTab agentId={agentId} />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SettingsTab agentId={agentId} />
        </TabsContent>
      </Tabs>

      <DeleteAgentDialog agentId={agentId} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </motion.div>
  );
}
