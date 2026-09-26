"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileText,
  Library,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Pencil,
  Trash2,
  Wrench,
  Check,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/cortex-client";
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

const AGENT_TABS: Array<{ value: AgentTab; label: string }> = [
  { value: "overview", label: "نمای کلی" },
  { value: "knowledge", label: "دانش" },
  { value: "ai", label: "هوش مصنوعی" },
  { value: "tools", label: "ابزارها" },
  { value: "playground", label: "پلی‌گراند" },
  { value: "api", label: "API" },
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


function ProviderTab({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["agent-provider", agentId],
    queryFn: () => api.getAgentProviderConfig(agentId),
  });

  const [providerName, setProviderName] = useState("AI Gateway");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [authMode, setAuthMode] = useState("bearer");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);

  // Sync saved configuration into the editable form.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const config = data?.config;
    if (!config) return;
    setProviderName(config.providerName);
    setBaseUrl(config.baseUrl);
    setModel(config.model);
    setAuthMode(config.authMode);
    setEnabled(config.enabled);
  }, [data?.config]);

  const saveMutation = useMutation({
    mutationFn: () => api.saveAgentProviderConfig(agentId, {
      providerName: providerName.trim(),
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      authMode,
      apiKey: apiKey.trim() || undefined,
      enabled,
    }),
    onSuccess: () => {
      setApiKey("");
      queryClient.invalidateQueries({ queryKey: ["agent-provider", agentId] });
      toast.success("اتصال هوش مصنوعی این ایجنت ذخیره شد");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMutation = useMutation({
    mutationFn: () => api.testAgentProviderHealth(agentId),
    onSuccess: (result) => {
      toast.success("اتصال برقرار است — " + faNum(result.llm.latencyMs) + " میلی‌ثانیه");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) return <Skeleton className="h-96 rounded-2xl" />;
  if (isError || !data) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "دریافت اتصال هوش مصنوعی ناموفق بود."}
        onRetry={() => void refetch()}
      />
    );
  }

  const hasKey = Boolean(data.config?.hasApiKey);
  const providerConfigured = data.status.status === "configured";
  const canSave =
    providerName.trim().length >= 2 &&
    /^https?:\/\//i.test(baseUrl.trim()) &&
    model.trim().length > 0 &&
    (hasKey || apiKey.trim().length > 0 || authMode === "none");

  return (
    <div className="space-y-6">
      <Card className="cortex-panel rounded-2xl">
        <CardHeader className="border-b [.border-b]:pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <KeyRound className="size-4" />
                </span>
                اتصال اختصاصی هوش مصنوعی
              </CardTitle>
              <CardDescription className="mt-2 leading-6">
                این اتصال فقط برای همین ایجنت استفاده می‌شود. کلید API در سرور به‌صورت رمزنگاری‌شده ذخیره می‌شود و دوباره در رابط کاربری نمایش داده نمی‌شود. «پیکربندی‌شده» یعنی مشخصات اتصال کامل است؛ برای اطمینان از دسترسی واقعی، «تست اتصال» را اجرا کنید.
              </CardDescription>
            </div>
            <Badge
              variant={data.config && data.config.enabled && providerConfigured ? "default" : "outline"}
              className="shrink-0"
            >
              {data.config && data.config.enabled && providerConfigured ? "پیکربندی‌شده" : data.config ? "نیاز به بررسی" : "متصل نشده"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>نام سرویس</Label>
            <Input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="مثلاً OpenRouter یا AI Gateway" />
          </div>

          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input dir="ltr" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://.../v1" />
          </div>

          <div className="space-y-2">
            <Label>Model ID</Label>
            <Input dir="ltr" value={model} onChange={(e) => setModel(e.target.value)} placeholder="model-name" />
          </div>

          <div className="space-y-2">
            <Label>روش احراز</Label>
            <Select value={authMode} onValueChange={setAuthMode}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="انتخاب روش" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bearer">Bearer</SelectItem>
                <SelectItem value="x-api-key">X-API-Key</SelectItem>
                <SelectItem value="none">بدون کلید</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>API Key {hasKey ? "(برای نگه‌داشتن کلید فعلی خالی بگذارید)" : "*"}</Label>
            <Input
              dir="ltr"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? "••••••••••••••••" : "کلید API سرویس‌دهنده"}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              کلید خام هرگز به مرورگر برگردانده نمی‌شود.
            </p>
          </div>

          <div className="md:col-span-2 flex items-center justify-between rounded-xl border border-white/[.07] bg-white/[.02] p-4">
            <div>
              <p className="text-sm font-medium">استفاده برای پاسخ‌گویی این ایجنت</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                این اتصال برای Playground، تلگرام و API همین ایجنت استفاده می‌شود.
              </p>
            </div>
            <input
              aria-label="فعال بودن اتصال ایجنت"
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4 accent-primary"
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={testMutation.isPending || !data.config}
              onClick={() => testMutation.mutate()}
            >
              {testMutation.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              {testMutation.isPending ? "در حال تست..." : "تست اتصال"}
            </Button>
            <Button disabled={saveMutation.isPending || !canSave} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending && <Loader2 className="animate-spin" />}
              {saveMutation.isPending ? "در حال ذخیره..." : "ذخیره اتصال"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-amber-500/20 bg-amber-500/[.035]">
        <CardContent className="flex gap-3 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <div className="space-y-1 text-sm leading-7">
            <p className="font-semibold">فرمت اتصال</p>
            <p className="text-muted-foreground">
              Provider باید API سازگار با قالب OpenAI Chat Completions داشته باشد؛ Base URL و Model ID را دقیقاً مطابق سرویس‌دهنده وارد کنید.
            </p>
          </div>
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
        <TabsList className="grid w-full grid-cols-7">
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
        <TabsContent value="ai" className="mt-6">
          <ProviderTab agentId={agentId} />
        </TabsContent>
        <TabsContent value="tools" className="mt-6">\n          <ToolsTab agentId={agentId} />\n        </TabsContent>\n        <TabsContent value="playground" className="mt-4">
          <Playground agentId={agentId} />
        </TabsContent>
        <TabsContent value="api" className="mt-6">
          <AgentApiAccess agentId={agentId} />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SettingsTab agentId={agentId} />
        </TabsContent>
      </Tabs>

      <DeleteAgentDialog agentId={agentId} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </motion.div>
  );
}
