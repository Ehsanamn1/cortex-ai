"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bot, FileText, MessagesSquare, Plus } from "lucide-react";

import { api } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { EmptyState, ErrorState, useErrorToast } from "@/components/cortex/bits";
import { faNum, languageLabel, timeAgoFa, toneLabel } from "@/components/cortex/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function AgentsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-44 rounded-xl" />
      ))}
    </div>
  );
}

export function AgentsView() {
  const openAgent = useCortexStore((s) => s.openAgent);
  const setView = useCortexStore((s) => s.setView);
  const activeWorkspaceId = useCortexStore((s) => s.activeWorkspaceId);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["agents", activeWorkspaceId],
    queryFn: () => api.getAgents(activeWorkspaceId ?? undefined),
    enabled: !!activeWorkspaceId,
  });

  useErrorToast(isError ? error : null);

  if (isPending) return <AgentsSkeleton />;

  if (isError || !data) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "دریافت فهرست ایجنت‌ها ناموفق بود."}
        onRetry={() => void refetch()}
      />
    );
  }

  const agents = data.agents;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <p className="text-sm text-muted-foreground">{faNum(agents.length)} ایجنت</p>
        <Button size="sm" onClick={() => setView("agent-new")}>
          <Plus />
          ایجاد ایجنت
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
          description="ایجنت اول خود را بسازید تا دانش سازمان‌تان را آموزش دهید و پاسخ‌های هوشمند دریافت کنید."
          action={
            <Button onClick={() => setView("agent-new")}>
              <Plus />
              ایجاد ایجنت
            </Button>
          }
          className="bg-card"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent, index) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.2), ease: "easeOut" }}
              whileHover={{ y: -3 }}
            >
              <button
                type="button"
                onClick={() => openAgent(agent.id)}
                aria-label={`مشاهده جزئیات ایجنت ${agent.name}`}
                className="w-full text-start"
              >
                <Card className="h-full gap-0 rounded-xl py-0 transition-colors hover:border-primary/40">
                  <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-primary/10 text-primary"
                        >
                          <Bot className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{agent.name}</p>
                          {agent.orgName && (
                            <p className="truncate text-xs text-muted-foreground">{agent.orgName}</p>
                          )}
                        </div>
                      </div>
                      <span
                        title={agent.status === "active" ? "فعال" : agent.status}
                        aria-label={`وضعیت: ${agent.status === "active" ? "فعال" : agent.status}`}
                        className={cn(
                          "inline-block size-2.5 shrink-0 rounded-full",
                          agent.status === "active" ? "bg-emerald-400" : "bg-muted-foreground"
                        )}
                      />
                    </div>

                    {agent.description && (
                      <p className="line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
                        {agent.description}
                      </p>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="font-normal">
                        {languageLabel(agent.language)}
                      </Badge>
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        {toneLabel(agent.tone, agent.customTone)}
                      </Badge>
                      <span className="ms-auto flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1" title="منابع دانش">
                          <FileText aria-hidden="true" className="size-3.5" />
                          {faNum(agent._count.knowledgeSources)}
                        </span>
                        <span className="inline-flex items-center gap-1" title="گفتگوها">
                          <MessagesSquare aria-hidden="true" className="size-3.5" />
                          {faNum(agent._count.conversations)}
                        </span>
                      </span>
                    </div>

                    <p className="border-t pt-3 text-[11px] text-muted-foreground">
                      آخرین به‌روزرسانی {timeAgoFa(agent.updatedAt)}
                    </p>
                  </CardContent>
                </Card>
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
