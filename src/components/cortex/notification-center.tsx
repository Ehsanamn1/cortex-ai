"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCircle2, CircleAlert, Info, Sparkles } from "lucide-react";
import { api } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { timeAgoFa } from "@/components/cortex/format";

const SEEN_KEY = "cortex-notifications-seen-v1";

export function NotificationCenter() {
  const workspaceId = useCortexStore((s) => s.activeWorkspaceId);
  const [seenAt, setSeenAt] = useState(0);
  const [open, setOpen] = useState(false);
  const dashboard = useQuery({
    queryKey: ["dashboard-notifications", workspaceId],
    queryFn: () => api.getDashboard(workspaceId ?? undefined),
    enabled: !!workspaceId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    try {
      setSeenAt(Number(localStorage.getItem(SEEN_KEY)) || 0);
    } catch {}
  }, []);

  const items = dashboard.data?.activity ?? [];
  const unread = useMemo(() => items.filter((item) => new Date(item.createdAt).getTime() > seenAt).length, [items, seenAt]);

  function markRead() {
    const now = Date.now();
    setSeenAt(now);
    try { localStorage.setItem(SEEN_KEY, String(now)); } catch {}
  }

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) markRead(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unread ? "اعلان‌های جدید" : "اعلان‌ها"} className="relative rounded-xl border border-transparent hover:border-border/60">
          <Bell className="size-[18px]" />
          {unread > 0 && <span className="absolute end-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground shadow-[0_0_14px_rgba(59,130,246,.55)]">{unread > 9 ? "۹+" : unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-[min(92vw,380px)] rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div><p className="text-sm font-bold">اعلان‌ها</p><p className="mt-0.5 text-[10px] text-muted-foreground">رخدادهای واقعی فضای کاری فعلی</p></div>
          <Sparkles className="size-4 text-primary" />
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-5 py-10 text-center"><Info className="mx-auto size-7 text-muted-foreground/40" /><p className="mt-2 text-sm font-medium">فعلاً اعلان تازه‌ای نیست.</p><p className="mt-1 text-xs text-muted-foreground">ساخت ایجنت، دانش و سایر رخدادها این‌جا نمایش داده می‌شوند.</p></div>
          ) : items.slice(0, 10).map((item) => (
            <div key={item.id} className="flex items-start gap-3 border-b border-border/50 px-4 py-3 last:border-b-0">
              <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl", /fail|error|delete/i.test(item.action) ? "bg-amber-400/10 text-amber-300" : "bg-primary/10 text-primary")}>
                {/fail|error/i.test(item.action) ? <CircleAlert className="size-4" /> : <CheckCircle2 className="size-4" />}
              </span>
              <div className="min-w-0 flex-1"><p className="text-xs font-semibold leading-5">{item.action}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{item.entityType} · {timeAgoFa(item.createdAt)}</p></div>
            </div>
          ))}
        </div>
        {items.length > 0 && <button type="button" onClick={markRead} className="w-full border-t border-border/70 px-4 py-3 text-xs font-semibold text-primary hover:bg-muted/40">همه به‌عنوان خوانده‌شده</button>}
      </PopoverContent>
    </Popover>
  );
}
