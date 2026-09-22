"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronLeft, Loader2, MessagesSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { EmptyState, ErrorState, useErrorToast } from "@/components/cortex/bits";
import { faNum, timeAgoFa } from "@/components/cortex/format";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ConversationRow {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

function ConversationRowItem({ row }: { row: ConversationRow }) {
  const openConversation = useCortexStore((s) => s.openConversation);
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteConversation(row.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversations-all"] });
      queryClient.invalidateQueries({ queryKey: ["agent", row.agentId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.removeQueries({ queryKey: ["conversation", row.id] });
      toast.success("گفتگو حذف شد");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div>
      <div className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-accent">
        <button
          type="button"
          onClick={() => openConversation(row.agentId, row.id)}
          className="flex min-w-0 flex-1 items-center gap-3 text-start"
          aria-label={`باز کردن گفتگوی ${row.title}`}
        >
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-primary">
            <MessagesSquare className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{row.title}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {row.agentName}
              </Badge>
              <span>
                {faNum(row.messageCount)} پیام · {timeAgoFa(row.updatedAt)}
              </span>
            </span>
          </span>
          <ChevronLeft aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`حذف گفتگوی ${row.title}`}
          title="حذف گفتگو"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          disabled={deleteMutation.isPending}
          onClick={() => setDeleteOpen(true)}
        >
          {deleteMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        </Button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف گفتگو</AlertDialogTitle>
            <AlertDialogDescription>
              کل تاریخچه این گفتگو به همراه پیام‌های آن به‌طور کامل حذف می‌شود و قابل بازگشت نیست.
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
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ConversationsView() {
  const {
    data: agentsData,
    isPending: agentsPending,
    isError: agentsError,
    error: agentsErrorObject,
    refetch: refetchAgents,
  } = useQuery({
    queryKey: ["agents", useCortexStore.getState().activeWorkspaceId],
    queryFn: () => api.getAgents(useCortexStore.getState().activeWorkspaceId ?? undefined),
    enabled: !!useCortexStore.getState().activeWorkspaceId,
  });

  useErrorToast(agentsError ? agentsErrorObject : null);

  const agents = agentsData?.agents ?? [];
  const agentIds = useMemo(() => agents.map((a) => a.id).join(","), [agents]);

  const {
    data: conversations = [],
    isPending: conversationsPending,
    isError: conversationsError,
    error: conversationsErrorObject,
    refetch: refetchConversations,
  } = useQuery({
    queryKey: ["conversations-all", agentIds],
    enabled: agents.length > 0,
    queryFn: async (): Promise<ConversationRow[]> => {
      const results = await Promise.all(
        agents.map(async (agent) => {
          const { conversations: list } = await api.getConversations(agent.id);
          return list.map((conversation) => ({
            id: conversation.id,
            agentId: agent.id,
            agentName: agent.name,
            title: conversation.title,
            messageCount: conversation.messageCount,
            updatedAt: conversation.updatedAt,
          }));
        })
      );
      return results
        .flat()
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    },
  });

  useErrorToast(conversationsError ? conversationsErrorObject : null);

  const isPending = agentsPending || (agents.length > 0 && conversationsPending && !conversations);

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-xl" />
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

  if (conversationsError) {
    return (
      <ErrorState
        message={conversationsErrorObject instanceof Error ? conversationsErrorObject.message : "دریافت گفتگوها ناموفق بود."}
        onRetry={() => void refetchConversations()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">گفتگوها</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          همه گفتگوهای انجام‌شده با ایجنت‌های این فضای کاری.
        </p>
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          icon={
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl border bg-muted text-primary">
              <MessagesSquare className="size-7" />
            </span>
          }
          title="هنوز گفتگویی ثبت نشده است"
          description="با اولین گفتگو در پلی‌گراند هر ایجنت شروع کنید؛ گفتگوها این‌جا فهرست می‌شوند."
          className="bg-card"
        />
      ) : (
        <Card className="rounded-xl">
          <CardHeader className="sr-only">
            <CardTitle>فهرست گفتگوها</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y">
              {conversations.map((row, index) => (
                <motion.li
                  key={row.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.2), ease: "easeOut" }}
                >
                  <ConversationRowItem row={row} />
                </motion.li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
