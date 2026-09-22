"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, FileUp, Globe, Library, Plus, Database, ShieldCheck, Zap } from "lucide-react";

import { api } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { AddFileDialog, AddUrlDialog, SourcesList, useSourceTransitionToasts } from "@/components/cortex/knowledge";
import { EmptyState, ErrorState, useErrorToast } from "@/components/cortex/bits";
import { faNum } from "@/components/cortex/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface KnowledgeGroup {
  agentId: string;
  agentName: string;
  sources: Awaited<ReturnType<typeof api.getKnowledge>>["sources"];
}

export function KnowledgeView() {
  const setView = useCortexStore((s) => s.setView);
  const activeWorkspaceId = useCortexStore((s) => s.activeWorkspaceId);

  const [addOpen, setAddOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [fileOpen, setFileOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);

  const {
    data: agentsData,
    isPending: agentsPending,
    isError: agentsError,
    error: agentsErrorObject,
    refetch: refetchAgents,
  } = useQuery({
    queryKey: ["agents", activeWorkspaceId],
    queryFn: () => api.getAgents(activeWorkspaceId ?? undefined),
    enabled: !!activeWorkspaceId,
  });

  useErrorToast(agentsError ? agentsErrorObject : null);

  const agents = agentsData?.agents ?? [];
  const agentIds = useMemo(() => agents.map((a) => a.id).join(","), [agents]);

  const {
    data: groups,
    isPending: groupsPending,
    isError: groupsError,
    error: groupsErrorObject,
    refetch: refetchGroups,
  } = useQuery({
    queryKey: ["knowledge-all", agentIds],
    enabled: agents.length > 0,
    queryFn: async (): Promise<KnowledgeGroup[]> => {
      return Promise.all(
        agents.map(async (agent) => ({
          agentId: agent.id,
          agentName: agent.name,
          sources: (await api.getKnowledge(agent.id)).sources,
        }))
      );
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.some((group) =>
        group.sources.some((s) => s.status === "pending" || s.status === "processing")
      )
        ? 2500
        : false;
    },
  });

  useErrorToast(groupsError ? groupsErrorObject : null);

  const groupsWithSources = (groups ?? []).filter((group) => group.sources.length > 0);
  const totalSources = groups?.reduce((sum, group) => sum + group.sources.length, 0) ?? 0;

  if (agentsPending || (agents.length > 0 && groupsPending && !groups)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (agentsError || !agentsData) {
    return (
      <ErrorState
        message={agentsErrorObject instanceof Error ? agentsErrorObject.message : "دریافت فهرست ایجنت‌ها ناموفق بود."}
        onRetry={() => void refetchAgents()}
      />
    );
  }

  if (groupsError) {
    return (
      <ErrorState
        message={groupsErrorObject instanceof Error ? groupsErrorObject.message : "دریافت منابع دانش ناموفق بود."}
        onRetry={() => void refetchGroups()}
      />
    );
  }

  return (
    <div className="space-y-7">
      <section className="cortex-panel relative overflow-hidden rounded-[28px] p-5 sm:p-7">
        <div className="absolute -end-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -start-16 -bottom-20 size-56 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="cortex-kicker">مرکز دانش</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">هر داده‌ای که ایجنت برای کارش لازم دارد، این‌جا مدیریت کن.</h2>
            <p className="mt-3 text-sm leading-8 text-muted-foreground">اسناد، متن و داده‌های ساختاریافته را وارد کن؛ سیستم آن‌ها را استخراج، قطعه‌بندی و برای بازیابی در پاسخ‌های ایجنت ایندکس می‌کند.</p>
          </div>
          <Button onClick={() => setAddOpen(true)} disabled={agents.length === 0}><Plus />افزودن منبع</Button>
        </div>
        <div className="relative mt-6 grid gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.02] p-3"><span className="flex size-9 items-center justify-center rounded-lg border bg-primary/10 text-primary"><Database className="size-4"/></span><div><p className="text-xs font-medium">فایل تا ۲۰MB</p><p className="mt-0.5 text-[10px] text-muted-foreground">بارگذاری مستقیم و امن</p></div></div>
          <div className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.02] p-3"><span className="flex size-9 items-center justify-center rounded-lg border bg-violet-400/10 text-violet-300"><Zap className="size-4"/></span><div><p className="text-xs font-medium">پردازش خودکار</p><p className="mt-0.5 text-[10px] text-muted-foreground">استخراج و ایندکس پس از دریافت</p></div></div>
          <div className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.02] p-3"><span className="flex size-9 items-center justify-center rounded-lg border bg-emerald-400/10 text-emerald-300"><ShieldCheck className="size-4"/></span><div><p className="text-xs font-medium">اسکوپ‌شده برای هر ایجنت</p><p className="mt-0.5 text-[10px] text-muted-foreground">دانش بین فضاها قاطی نمی‌شود</p></div></div>
        </div>
      </section>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-foreground">دانش</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            همه منابع دانش فضای کاری، گروه‌بندی‌شده بر اساس ایجنت.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={agents.length === 0}>
          <Plus />
          افزودن منبع
        </Button>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          icon={
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl border bg-muted text-primary">
              <Bot className="size-7" />
            </span>
          }
          title="هنوز ایجنتی نساخته‌اید"
          description="برای افزودن دانش، ابتدا یک ایجنت بسازید؛ سپس فایل‌ها و وب‌سایت‌های خود را به آن آموزش دهید."
          action={
            <Button onClick={() => setView("agent-new")}>
              <Plus />
              ایجاد ایجنت
            </Button>
          }
          className="bg-card"
        />
      ) : totalSources === 0 ? (
        <EmptyState
          icon={
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl border bg-muted text-primary">
              <Library className="size-7" />
            </span>
          }
          title="هنوز منبع دانشی اضافه نشده است"
          description="فایل PDF، TXT، DOCX یا آدرس وب‌سایت اضافه کنید تا ایجنت‌ها از آن برای پاسخ‌دهی استفاده کنند."
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus />
              افزودن منبع
            </Button>
          }
          className="bg-card"
        />
      ) : (
        <div className="space-y-8">
          {groupsWithSources.map((group) => (
            <section key={group.agentId} aria-labelledby={`knowledge-agent-${group.agentId}`} className="space-y-3">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-lg border bg-muted text-primary">
                  <Bot className="size-4" />
                </span>
                <h3 id={`knowledge-agent-${group.agentId}`} className="text-sm font-semibold text-foreground">
                  {group.agentName}
                </h3>
                <span className="rounded-full border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  {faNum(group.sources.length)} منبع
                </span>
              </div>
              <Card className="gap-0 rounded-xl py-0">
                <CardHeader className="sr-only">
                  <CardTitle>منابع دانش {group.agentName}</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <SourcesList sources={group.sources} />
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}

      {/* Agent picker → then file/url dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setSelectedAgentId("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>افزودن منبع دانش</DialogTitle>
            <DialogDescription>ابتدا ایجنت مقصد را انتخاب کنید، سپس نوع منبع را مشخص کنید.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="knowledge-agent-select">ایجنت</Label>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger id="knowledge-agent-select" className="w-full">
                <SelectValue placeholder="انتخاب ایجنت" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              disabled={!selectedAgentId}
              onClick={() => {
                setAddOpen(false);
                setFileOpen(true);
              }}
            >
              <FileUp />
              افزودن فایل
            </Button>
            <Button
              variant="outline"
              disabled={!selectedAgentId}
              onClick={() => {
                setAddOpen(false);
                setUrlOpen(true);
              }}
            >
              <Globe />
              افزودن وب‌سایت
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedAgentId && (
        <>
          <AddFileDialog agentId={selectedAgentId} open={fileOpen} onOpenChange={setFileOpen} />
          <AddUrlDialog agentId={selectedAgentId} open={urlOpen} onOpenChange={setUrlOpen} />
        </>
      )}
    </div>
  );
}
