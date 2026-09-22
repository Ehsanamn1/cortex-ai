"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  Bot,
  ExternalLink,
  Info,
  Loader2,
  MessagesSquare,
  Plus,
  ScanSearch,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  api,
  type ConversationDetailDto,
  type ConversationListItemDto,
  type MessageDto,
  type RetrievalRef,
} from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { useAgentKnowledge } from "@/components/cortex/knowledge";
import { faNum, formatTimeFa, languageLabel, toneLabel } from "@/components/cortex/format";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const EXAMPLE_QUESTIONS = [
  "قیمت محصولات شما چقدر است؟",
  "خدمات شما شامل چه مواردی است؟",
  "ساعات کاری شما چگونه است؟",
];

const NEW_CONVERSATION_VALUE = "__new__";

/* ---------------- small pieces ---------------- */

function sourceDotClass(status: string): string {
  switch (status) {
    case "ready":
      return "bg-emerald-400";
    case "failed":
      return "bg-destructive";
    case "processing":
      return "bg-primary";
    default:
      return "bg-amber-400";
  }
}

function ProviderStatusLine() {
  const { data } = useQuery({
    queryKey: ["providers-status"],
    queryFn: api.getProvidersStatus,
    staleTime: Infinity,
    retry: 1,
  });

  if (!data) return <p className="text-xs text-muted-foreground">وضعیت سرویس‌دهنده در حال بررسی است…</p>;

  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      {data.llm.status === "configured" ? (
        <>
          سرویس‌دهنده:{" "}
          <span className="font-medium text-foreground">
            {data.llm.provider}
            {data.llm.model ? ` · ${data.llm.model}` : ""}
          </span>
        </>
      ) : (
        "سرویس‌دهنده هوش مصنوعی پیکربندی نشده است؛ پاسخ‌دهی فعال نخواهد بود."
      )}
    </p>
  );
}

function AgentInfoPanelContent({ agentId }: { agentId: string }) {
  const { data: agentData } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => api.getAgent(agentId),
    staleTime: 30_000,
  });
  const { data: knowledgeData } = useAgentKnowledge(agentId);
  const sources = knowledgeData?.sources ?? [];

  const agent = agentData?.agent;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-primary/10 text-primary">
          <Bot className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{agent?.name ?? "…"}</p>
          {agent?.orgName && <p className="truncate text-xs text-muted-foreground">{agent.orgName}</p>}
        </div>
      </div>

      {agent && (
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
            {languageLabel(agent.language)}
          </span>
          <span className="rounded-full border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
            {toneLabel(agent.tone, agent.customTone)}
          </span>
        </div>
      )}

      <Separator />

      <div className="space-y-2.5">
        <p className="text-xs font-semibold text-foreground">منابع دانش ({faNum(sources.length)})</p>
        {sources.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">هنوز منبعی اضافه نشده است؛ پاسخ‌ها مبتنی بر دانش نخواهند بود.</p>
        ) : (
          <ul className="space-y-2">
            {sources.map((source) => (
              <li key={source.id} className="flex items-center gap-2 text-xs">
                <span
                  aria-hidden="true"
                  title={source.status}
                  className={cn("size-2 shrink-0 rounded-full", sourceDotClass(source.status))}
                />
                <span className="truncate text-muted-foreground" title={source.name}>
                  {source.name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Separator />

      <ProviderStatusLine />
    </div>
  );
}

function retrievalScorePercent(score: number): string {
  const clamped = score <= 1 ? score * 100 : score;
  return `${faNum(Math.max(0, Math.round(clamped)))}٪`;
}

function RetrievalList({ retrieval }: { retrieval: RetrievalRef[] }) {
  return (
    <ul className="space-y-2.5">
      {retrieval.map((item, index) => (
        <li key={`${item.index}-${index}`} className="space-y-1.5 rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-medium text-foreground" title={item.documentName}>
              <span className="text-muted-foreground">#{faNum(item.index || index + 1)}</span> {item.documentName}
            </p>
            <span className="shrink-0 text-xs font-medium text-primary">{retrievalScorePercent(item.score)}</span>
          </div>
          {item.page != null && <p className="text-[11px] text-muted-foreground">صفحه {faNum(item.page)}</p>}
          {item.snippet && (
            <p dir="auto" className="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
              {item.snippet}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function DebugPanelContent({ messages }: { messages: MessageDto[] }) {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const retrieval = lastAssistant?.metadata?.retrieval ?? [];

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        قطعات بازیابی‌شده از دانش برای آخرین پاسخ ایجنت — به ترتیب نزدیکی معنایی.
      </p>
      {retrieval.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          هنوز بازیابی ثبت نشده است.
        </p>
      ) : (
        <RetrievalList retrieval={retrieval} />
      )}
    </div>
  );
}

/* ---------------- message bubbles ---------------- */

function SourceChips({ message }: { message: MessageDto }) {
  const sources = message.metadata?.sources ?? [];
  if (sources.length === 0) return null;

  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {sources.map((source, index) => {
        const label = (
          <>
            <span>منبع: {source.documentName}</span>
            {source.page != null && <span> · صفحه {faNum(source.page)}</span>}
            {source.sourceUrl && <ExternalLink aria-hidden="true" className="size-3" />}
          </>
        );
        const className =
          "inline-flex max-w-full items-center gap-1 rounded-full border bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors";
        return source.sourceUrl ? (
          <a
            key={`${source.index}-${index}`}
            href={source.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(className, "hover:border-primary/40 hover:text-foreground")}
          >
            {label}
          </a>
        ) : (
          <span key={`${source.index}-${index}`} className={className}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function AssistantContent({ content }: { content: string }) {
  return (
    <div dir="auto" className="text-sm leading-[1.9] text-foreground">
      <ReactMarkdown
        breaks
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap [&:not(:first-child)]:mt-3">{children}</p>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 ps-5">{children}</ul>,
          ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 ps-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ children }) => (
            <code dir="ltr" className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-xs text-primary">
              {children}
            </code>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function MessageBubble({ message }: { message: MessageDto }) {
  if (message.role === "system") {
    return (
      <p className="py-1 text-center text-[11px] leading-relaxed text-muted-foreground">{message.content}</p>
    );
  }

  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="flex max-w-[85%] flex-col self-end sm:max-w-[75%]"
      >
        <div dir="auto" className="rounded-2xl rounded-bl-sm border border-primary/25 bg-primary/12 px-4 py-2.5 text-sm leading-relaxed text-foreground">
          <p className="whitespace-pre-wrap">{message.content}</p>
          <span className="mt-1 block text-left text-[10px] text-muted-foreground">
            {formatTimeFa(message.createdAt)}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="flex max-w-[85%] flex-col self-start sm:max-w-[75%]"
    >
      <div className="rounded-2xl rounded-br-sm border bg-muted px-4 py-3">
        <AssistantContent content={message.content} />
        <SourceChips message={message} />
        <span className="mt-1.5 block text-right text-[10px] text-muted-foreground">
          {formatTimeFa(message.createdAt)}
        </span>
      </div>
    </motion.div>
  );
}

function TypingBubble() {
  return (
    <div className="flex self-start rounded-2xl rounded-br-sm border bg-muted px-4 py-3.5" aria-live="polite" aria-label="ایجنت در حال نوشتن است">
      <span className="flex items-center gap-1.5">
        <span className="cortex-dot size-2 rounded-full bg-muted-foreground" />
        <span className="cortex-dot size-2 rounded-full bg-muted-foreground" />
        <span className="cortex-dot size-2 rounded-full bg-muted-foreground" />
      </span>
    </div>
  );
}

/* ---------------- main playground ---------------- */

export function Playground({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const activeConversationId = useCortexStore((s) => s.activeConversationId);
  const setActiveConversationId = useCortexStore((s) => s.setActiveConversationId);

  const [input, setInput] = useState("");
  const [awaiting, setAwaiting] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [optimisticMessage, setOptimisticMessage] = useState<MessageDto | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"info" | "debug" | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversationsData } = useQuery({
    queryKey: ["conversations", agentId],
    queryFn: () => api.getConversations(agentId),
  });
  const conversations: ConversationListItemDto[] = conversationsData?.conversations ?? [];
  const currentId =
    activeConversationId && conversations.some((c) => c.id === activeConversationId) ? activeConversationId : null;

  const { data: conversationData, refetch } = useQuery({
    queryKey: ["conversation", currentId],
    queryFn: () => api.getConversation(currentId as string),
    enabled: !!currentId,
  });

  const serverMessages = useMemo(() => conversationData?.messages ?? [], [conversationData]);

  /* Hide the optimistic bubble once the server echoes the same user message. */
  const messages = useMemo(() => {
    if (!optimisticMessage) return serverMessages;
    const last = serverMessages[serverMessages.length - 1];
    if (last && last.role === "user" && last.content === optimisticMessage.content) return serverMessages;
    return [...serverMessages, optimisticMessage];
  }, [serverMessages, optimisticMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, awaiting, sendError]);

  const newConversationMutation = useMutation({
    mutationFn: () => api.createConversation(agentId),
    onSuccess: ({ conversation }) => {
      queryClient.setQueryData<{ conversations: ConversationListItemDto[] }>(["conversations", agentId], (old) =>
        old ? { conversations: [conversation, ...old.conversations] } : { conversations: [conversation] }
      );
      setSendError(null);
      setActiveConversationId(conversation.id);
      queryClient.invalidateQueries({ queryKey: ["conversations", agentId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function ensureConversation(): Promise<string> {
    if (currentId) return currentId;
    const { conversation } = await api.createConversation(agentId);
    queryClient.setQueryData<{ conversations: ConversationListItemDto[] }>(["conversations", agentId], (old) =>
      old ? { conversations: [conversation, ...old.conversations] } : { conversations: [conversation] }
    );
    setActiveConversationId(conversation.id);
    return conversation.id;
  }

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function resetTextarea() {
    const el = textareaRef.current;
    if (el) el.style.height = "auto";
  }

  async function handleSend() {
    const content = input.trim();
    if (!content || awaiting) return;

    setSendError(null);
    setInput("");
    resetTextarea();

    let conversationId: string;
    try {
      conversationId = await ensureConversation();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "ایجاد گفتگو ناموفق بود.");
      return;
    }

    setOptimisticMessage({
      id: `optimistic-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
      metadata: null,
    });
    setAwaiting(true);

    try {
      const response = await api.chat(conversationId, content);
      queryClient.setQueryData<ConversationDetailDto>(["conversation", conversationId], (old) =>
        old
          ? { ...old, messages: [...old.messages, response.userMessage, response.assistantMessage] }
          : old
      );
      setOptimisticMessage(null);
      queryClient.invalidateQueries({ queryKey: ["conversations", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["conversations-all"] });
      void refetch();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "ارسال پیام ناموفق بود.");
      /* The user message is usually persisted server-side; refetch for an honest view. */
      try {
        await refetch();
      } catch {
        /* keep the optimistic message visible */
      }
      setOptimisticMessage(null);
    } finally {
      setAwaiting(false);
    }
  }

  const isEmpty = messages.length === 0 && !awaiting && !sendError;
  const currentTitle = conversations.find((c) => c.id === currentId)?.title;

  return (
    <div className="flex h-[calc(100dvh-11.5rem)] min-h-[28rem] gap-4 lg:h-[calc(100dvh-9rem)]">
      {/* Agent info — right column (first in DOM, RTL) */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <ScrollArea className="h-full rounded-xl border bg-card p-4">
          <AgentInfoPanelContent agentId={agentId} />
        </ScrollArea>
      </aside>

      {/* Chat column */}
      <section aria-label="گفتگو با ایجنت" className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
        <header className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Select
              value={currentId ?? ""}
              onValueChange={(value) => {
                if (value === NEW_CONVERSATION_VALUE) {
                  newConversationMutation.mutate();
                } else {
                  setActiveConversationId(value);
                }
              }}
            >
              <SelectTrigger size="sm" className="min-w-0 flex-1 sm:w-64 sm:flex-none" aria-label="انتخاب گفتگو">
                <SelectValue placeholder="گفتگوی جدید">
                  {currentTitle ?? "گفتگوی جدید"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_CONVERSATION_VALUE}>
                  <Plus aria-hidden="true" className="size-3.5 text-primary" />
                  گفتگوی جدید
                </SelectItem>
                {conversations.map((conversation) => (
                  <SelectItem key={conversation.id} value={conversation.id}>
                    {conversation.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              aria-label="گفتگوی جدید"
              title="گفتگوی جدید"
              className="size-8 shrink-0"
              disabled={newConversationMutation.isPending}
              onClick={() => newConversationMutation.mutate()}
            >
              {newConversationMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="hidden lg:inline-flex"
              aria-pressed={showDebug}
              onClick={() => setShowDebug((v) => !v)}
            >
              <ScanSearch />
              {showDebug ? "بستن بازیابی" : "نمایش بازیابی"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="اطلاعات ایجنت"
              onClick={() => setMobilePanel("info")}
            >
              <Info />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="نمایش بازیابی دانش"
              onClick={() => setMobilePanel("debug")}
            >
              <ScanSearch />
            </Button>
          </div>
        </header>

        {/* Messages */}
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
              {isEmpty ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
                  <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl border bg-muted text-primary">
                    <MessagesSquare className="size-6" />
                  </span>
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">سؤال خود را بپرسید</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      پاسخ از دل دانش شما ساخته می‌شود و با ارجاع به منابع واقعی ارائه خواهد شد.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {EXAMPLE_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        type="button"
                        className="rounded-full border bg-muted/50 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        onClick={() => {
                          setInput(question);
                          textareaRef.current?.focus();
                        }}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {awaiting && <TypingBubble />}
                  {sendError && (
                    <div role="alert" className="flex flex-col self-stretch">
                      <div className="flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                        <p className="text-sm leading-relaxed text-destructive">{sendError}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="-me-1 size-7 shrink-0 text-destructive hover:text-destructive"
                          aria-label="بستن پیام خطا"
                          onClick={() => setSendError(null)}
                        >
                          <X />
                        </Button>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        پیام شما حفظ شده است؛ می‌توانید دوباره بپرسید یا پیام جدیدی بفرستید.
                      </p>
                    </div>
                  )}
                </>
              )}
              <div ref={bottomRef} aria-hidden="true" />
            </div>
          </ScrollArea>
        </div>

        {/* Composer */}
        <footer className="border-t p-3">
          <div className="mx-auto w-full max-w-3xl space-y-1.5">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                rows={1}
                dir="auto"
                value={input}
                placeholder="پیام خود را بنویسید…"
                aria-label="متن پیام"
                className="min-h-[44px] max-h-[120px] resize-none"
                onChange={(event) => {
                  setInput(event.target.value);
                  resizeTextarea();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                disabled={awaiting}
              />
              <Button
                size="icon"
                className="size-[44px] shrink-0"
                aria-label="ارسال پیام"
                disabled={!input.trim() || awaiting}
                onClick={() => void handleSend()}
              >
                {awaiting ? <Loader2 className="animate-spin" /> : <Send className="-scale-x-100" />}
              </Button>
            </div>
            <p className="px-1 text-[10px] text-muted-foreground">Enter برای ارسال · Shift + Enter برای خط جدید</p>
          </div>
        </footer>
      </section>

      {/* Debug panel — left column (desktop only) */}
      {showDebug && (
        <aside className="hidden w-80 shrink-0 flex-col overflow-hidden rounded-xl border bg-card lg:flex">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold text-foreground">بازیابی دانش</p>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="بستن پنل بازیابی"
              onClick={() => setShowDebug(false)}
            >
              <X />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            <DebugPanelContent messages={messages} />
          </ScrollArea>
        </aside>
      )}

      {/* Mobile sheets */}
      <Sheet open={mobilePanel === "info"} onOpenChange={(open) => !open && setMobilePanel(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl pb-8 pt-2">
          <SheetHeader className="p-2 text-right">
            <SheetTitle className="text-base">اطلاعات ایجنت</SheetTitle>
            <SheetDescription>مشخصات و منابع دانش ایجنت</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <AgentInfoPanelContent agentId={agentId} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={mobilePanel === "debug"} onOpenChange={(open) => !open && setMobilePanel(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl pb-8 pt-2">
          <SheetHeader className="p-2 text-right">
            <SheetTitle className="text-base">بازیابی دانش</SheetTitle>
            <SheetDescription>قطعات دانش استفاده‌شده در آخرین پاسخ</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-2">
            <DebugPanelContent messages={messages} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
