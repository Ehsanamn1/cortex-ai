"use client";

import { useEffect, useMemo, useState } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { Bot, BrainCircuit, FileText, MessageSquare, Search } from "lucide-react";
import { useCortexStore } from "@/components/cortex/store";
import { api, type SearchResultDto } from "@/lib/cortex-client";

export function SystemSearch({ triggerClassName, compact = false }: { triggerClassName?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const workspaceId = useCortexStore((s) => s.activeWorkspaceId);
  const setView = useCortexStore((s) => s.setView);
  const openAgent = useCortexStore((s) => s.openAgent);
  const openConversation = useCortexStore((s) => s.openConversation);
  const [results, setResults] = useState<SearchResultDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || !workspaceId || query.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (controller.signal.aborted) return;
      setLoading(true);
      try {
        const data = await api.searchSystem(query.trim(), workspaceId, controller.signal);
        if (!controller.signal.aborted) setResults(data.results);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 110);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, workspaceId]);

  const hasSearchQuery = open && Boolean(workspaceId) && query.trim().length >= 2;
  const visibleResults = hasSearchQuery ? results : [];
  const visibleLoading = hasSearchQuery && loading;
  const grouped = useMemo(() => ({
    agents: visibleResults.filter((x) => x.type === "agent"),
    knowledge: visibleResults.filter((x) => x.type === "knowledge"),
    conversations: visibleResults.filter((x) => x.type === "conversation"),
  }), [visibleResults]);

  function select(item: SearchResultDto) {
    setOpen(false);
    setQuery("");
    if (item.type === "agent") openAgent(item.id);
    else if (item.type === "conversation" && item.agentId) openConversation(item.agentId, item.id);
    else setView("knowledge");
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName ?? "cortex-search-trigger"} aria-label="جستجو در Cortex">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{compact ? "جستجو" : "جستجو در Cortex…"}</span>
        {!compact && <span className="ms-auto hidden rounded-md border border-border/70 bg-background/70 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground sm:inline-flex">⌘K</span>}
      </button>

      <CommandDialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }} title="جست‌وجوی Cortex" description="ایجنت، پایگاه دانش یا گفتگو را پیدا کنید." showCloseButton>
        <CommandInput placeholder="نام ایجنت، فایل دانش یا گفتگوی خود را بنویسید…" value={query} onValueChange={setQuery} />
        <div className="border-b border-border/70 px-4 py-2"><span className="text-[10px] font-bold text-muted-foreground">جست‌وجوی سریع در فضای کاری</span></div><CommandList className="max-h-[55vh] p-1">
          {visibleLoading && <div className="px-4 py-8 text-center text-sm text-muted-foreground">در حال جستجو در فضای کاری…</div>}
          {!visibleLoading && hasSearchQuery && visibleResults.length === 0 && <CommandEmpty>نتیجه‌ای در فضای کاری فعلی پیدا نشد.</CommandEmpty>}
          {grouped.agents.length > 0 && (
            <CommandGroup heading="ایجنت‌ها">
              {grouped.agents.map((item) => (
                <CommandItem key={item.type+item.id} value={item.title} onSelect={() => select(item)}>
                  <Bot className="text-primary" /><span className="min-w-0 flex-1 truncate">{item.title}</span><CommandShortcut>{item.subtitle}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {grouped.knowledge.length > 0 && (
            <CommandGroup heading="پایگاه دانش">
              {grouped.knowledge.map((item) => (
                <CommandItem key={item.type+item.id} value={item.title} onSelect={() => select(item)}>
                  <BrainCircuit className="text-violet-400" /><span className="min-w-0 flex-1 truncate">{item.title}</span><CommandShortcut>{item.subtitle}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {grouped.conversations.length > 0 && (
            <CommandGroup heading="گفتگوها">
              {grouped.conversations.map((item) => (
                <CommandItem key={item.type+item.id} value={item.title} onSelect={() => select(item)}>
                  <MessageSquare className="text-emerald-400" /><span className="min-w-0 flex-1 truncate">{item.title}</span><CommandShortcut>{item.subtitle}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {query.trim().length < 2 && (
            <div className="grid gap-2 p-4 sm:grid-cols-3">
              {[
                ["ایجنت", "ساخت و تنظیم ایجنت‌ها", Bot],
                ["پایگاه دانش", "منابع دانش و RAG", FileText],
                ["گفتگو", "مکالمه‌های اخیر", MessageSquare],
              ].map(([title, description, Icon]) => (
                <div key={String(title)} className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                  <Icon className="size-4 text-primary" />
                  <p className="mt-2 text-xs font-semibold">{String(title)}</p>
                  <p className="mt-1 text-[10px] leading-5 text-muted-foreground">{String(description)}</p>
                </div>
              ))}
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
