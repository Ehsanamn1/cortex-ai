"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Ban, Bot, BookOpen, Check, ClipboardList, RotateCw, Users } from "lucide-react";
import { toast } from "sonner";

import { api, type TelegramUserDto } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { faNum, timeAgoFa } from "@/components/cortex/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function UsageLimitsDialog({ user, open, onOpenChange, onSave, pending }: {
  user: TelegramUserDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (limits: Partial<Pick<TelegramUserDto, "dailyTokenLimit" | "monthlyTokenLimit">>) => void;
  pending: boolean;
}) {
  const [daily, setDaily] = useState(String(user?.dailyTokenLimit ?? 0));
  const [monthly, setMonthly] = useState(String(user?.monthlyTokenLimit ?? 0));
  if (!user) return null;
  const submit = () => onSave({ dailyTokenLimit: Number(daily) || 0, monthlyTokenLimit: Number(monthly) || 0 });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader><DialogTitle>سقف مصرف کاربر</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>توکن روزانه</Label><Input dir="ltr" inputMode="numeric" className="mt-2 text-left" value={daily} onChange={(e) => setDaily(e.target.value)} /></div>
          <div><Label>توکن ماهانه</Label><Input dir="ltr" inputMode="numeric" className="mt-2 text-left" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></div>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">عدد ۰ یعنی بدون سقف اختصاصی.</p>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button><Button disabled={pending} onClick={submit}>ذخیره</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminView() {
  const workspaceId = useCortexStore((s) => s.activeWorkspaceId);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("users");
  const [limitUser, setLimitUser] = useState<TelegramUserDto | null>(null);
  const overview = useQuery({ queryKey: ["admin-overview", workspaceId], queryFn: () => api.getAdminOverview(workspaceId ?? undefined), enabled: !!workspaceId });
  const users = useQuery({ queryKey: ["telegram-users-admin", workspaceId], queryFn: () => api.getTelegramUsers(workspaceId ?? undefined), enabled: !!workspaceId });
  const update = useMutation({
    mutationFn: (v: { id: string; status: "pending" | "allowed" | "blocked"; dailyTokenLimit?: number; monthlyTokenLimit?: number }) => api.updateTelegramUser(v.id, v.status, { dailyTokenLimit: v.dailyTokenLimit, monthlyTokenLimit: v.monthlyTokenLimit }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["admin-overview", workspaceId] }); void queryClient.invalidateQueries({ queryKey: ["telegram-users-admin", workspaceId] }); setLimitUser(null); toast.success("تغییرات کاربر ذخیره شد."); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (overview.isPending) return <div className="space-y-5"><div className="h-10 w-48 animate-pulse rounded-xl bg-muted" /><div className="grid gap-4 md:grid-cols-3"><div className="h-32 rounded-2xl bg-muted animate-pulse" /><div className="h-32 rounded-2xl bg-muted animate-pulse" /><div className="h-32 rounded-2xl bg-muted animate-pulse" /></div></div>;
  if (overview.isError || !overview.data) return <p className="text-sm text-destructive">دریافت مرکز مدیریت ناموفق بود. دوباره تلاش کنید.</p>;
  const data = overview.data;
  const userList = users.data?.users ?? data.users;
  return (
    <div className="space-y-8">
      <div><p className="cortex-kicker">عملیات</p><h2 className="mt-2 text-3xl font-semibold">مرکز کنترل</h2><p className="mt-2 text-sm text-muted-foreground">مدیریت واقعی ربات‌ها، کاربران، مصرف، دانش و رخدادهای این فضای کاری.</p></div>
      <div className="grid gap-4 md:grid-cols-3"><Metric icon={<Bot />} title="ربات تلگرام" value={faNum(data.bots.length)} /><Metric icon={<Users />} title="کاربران تلگرام" value={faNum(data.users.length)} /><Metric icon={<BookOpen />} title="منابع دانش" value={faNum(data.knowledge.length)} /></div>
      <Tabs value={tab} onValueChange={setTab} dir="rtl">
        <TabsList className="w-full justify-start overflow-x-auto bg-white/[.03]"><TabsTrigger value="users"><Users /> کاربران</TabsTrigger><TabsTrigger value="bots"><Bot /> ربات‌ها</TabsTrigger><TabsTrigger value="knowledge"><BookOpen /> دانش</TabsTrigger><TabsTrigger value="logs"><ClipboardList /> رخدادها</TabsTrigger></TabsList>
        <TabsContent value="users" className="mt-5"><Card className="cortex-panel"><CardContent className="p-0">{userList.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">هنوز کاربر تلگرامی ثبت نشده است.</div> : <div className="divide-y divide-white/5">{userList.map((user) => <div key={user.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium">{[user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || user.telegramUserId}</p><p dir="ltr" className="mt-1 truncate text-xs text-muted-foreground">{user.phoneNumber || "شماره تأیید نشده"} · {user.bot?.name || "—"}</p><p className="mt-1 text-[11px] text-muted-foreground">کل {faNum(user.usage?.tokens ?? 0)} · امروز {faNum(user.dailyUsage?.tokens ?? 0)} · ماه {faNum(user.monthlyUsage?.tokens ?? 0)} · سقف روزانه {user.dailyTokenLimit > 0 ? faNum(user.dailyTokenLimit) : "∞"} · ماهانه {user.monthlyTokenLimit > 0 ? faNum(user.monthlyTokenLimit) : "∞"}</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{user.status}</Badge><Button size="sm" variant="outline" onClick={() => update.mutate({ id: user.id, status: "allowed" })}><Check /> مجاز</Button><Button size="sm" variant="ghost" onClick={() => update.mutate({ id: user.id, status: "blocked" })}><Ban /> مسدود</Button><Button size="sm" variant="outline" onClick={() => setLimitUser(user)}>سقف مصرف</Button></div></div>)}</div>}</CardContent></Card></TabsContent>
        <TabsContent value="bots" className="mt-5"><div className="grid gap-4 md:grid-cols-2">{data.bots.map((bot: any) => <Card key={bot.id} className="cortex-panel"><CardContent className="p-5"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{bot.name}</p><p className="text-xs text-muted-foreground">@{bot.username || "—"} · {bot.agent.name}</p></div><Badge>{bot.status}</Badge></div><p className="mt-4 text-xs leading-6 text-muted-foreground">کاربران: {faNum(bot._count.users)} · allowlist: {faNum(bot._count.allowlist)}</p></CardContent></Card>)}</div></TabsContent>
        <TabsContent value="knowledge" className="mt-5"><Card className="cortex-panel"><CardContent className="p-0">{data.knowledge.map((item: any) => <div key={item.id} className="flex items-center justify-between gap-4 border-b border-white/5 p-4 last:border-0"><div className="min-w-0"><p className="truncate text-sm">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{timeAgoFa(item.updatedAt)}</p></div><div className="flex items-center gap-2"><Badge variant="outline">{item.status}</Badge>{item.status === "failed" ? <Button size="icon" variant="ghost" title="پردازش مجدد" onClick={() => api.retryKnowledgeSource(item.id).then(() => { toast.success("بازپردازش شروع شد"); void queryClient.invalidateQueries({ queryKey: ["admin-overview", workspaceId] }); }).catch((e: Error) => toast.error(e.message))}><RotateCw /></Button> : null}</div></div>)}</CardContent></Card></TabsContent>
        <TabsContent value="logs" className="mt-5"><Card className="cortex-panel"><CardContent className="p-0">{data.logs.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">رخدادی ثبت نشده است.</div> : data.logs.map((log: any) => <div key={log.id} className="flex items-center justify-between gap-4 border-b border-white/5 p-4 last:border-0"><div><p className="text-sm font-medium">{log.action}</p><p className="mt-1 text-xs text-muted-foreground">{log.entityType}{log.entityId ? " · " + String(log.entityId).slice(0, 8) : ""}</p></div><span className="text-xs text-muted-foreground">{timeAgoFa(log.createdAt)}</span></div>)}</CardContent></Card></TabsContent>
      </Tabs>
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300/10 bg-amber-300/[.04] p-4 text-xs leading-6 text-amber-100/80"><AlertTriangle className="mt-1 size-4 shrink-0" /><p>داده‌های این مرکز از دیتابیس فضای کاری خوانده می‌شوند؛ اعداد و وضعیت‌ها ساختگی نیستند.</p></div>
      <UsageLimitsDialog user={limitUser} open={!!limitUser} onOpenChange={(open) => { if (!open) setLimitUser(null); }} onSave={(limits) => { if (!limitUser) return; update.mutate({ id: limitUser.id, status: limitUser.status as "pending" | "allowed" | "blocked", ...limits }); }} pending={update.isPending} />
    </div>
  );
}

function Metric({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return <Card className="cortex-panel"><CardContent className="flex items-center gap-4 p-5"><div className="cortex-icon-box">{icon}</div><div><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{title}</p></div></CardContent></Card>;
}