"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Bot, CheckCircle2, Copy, Link2, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, Users, Wifi, XCircle } from "lucide-react";
import { toast } from "sonner";

import { api, type AgentDto, type TelegramBotDto } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function statusMeta(status: string) {
  if (status === "connected") return { label: "متصل", className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300", icon: CheckCircle2 };
  if (status === "error") return { label: "خطا", className: "border-destructive/20 bg-destructive/10 text-destructive", icon: XCircle };
  return { label: "آماده اتصال", className: "border-amber-400/20 bg-amber-400/10 text-amber-200", icon: Wifi };
}

export function TelegramView() {
  const workspaceId = useCortexStore((s) => s.activeWorkspaceId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TelegramBotDto | null>(null);

  const botsQ = useQuery({
    queryKey: ["telegram-bots", workspaceId],
    queryFn: () => api.getTelegramBots(workspaceId ?? undefined),
    enabled: !!workspaceId,
    refetchInterval: (query) => query.state.data?.bots.some((bot) => bot.status === "error") ? 8_000 : 30_000,
  });
  const agentsQ = useQuery({
    queryKey: ["agents", workspaceId],
    queryFn: () => api.getAgents(workspaceId ?? undefined),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });

  const bots = botsQ.data?.bots ?? [];
  const agents = agentsQ.data?.agents ?? [];

  const create = useMutation({
    mutationFn: (value: { workspaceId?: string; agentId: string; name: string; token: string }) => api.createTelegramBot({ ...value, mode: "webhook" }),
    onSuccess: ({ bot }) => {
      queryClient.invalidateQueries({ queryKey: ["telegram-bots", workspaceId] });
      if (bot.status === "connected") {
        toast.success("ربات با موفقیت متصل شد.");
      } else {
        toast.warning("ربات ساخته شد، اما اتصال Webhook کامل نشد. جزئیات را باز کن و «تست و اتصال مجدد» را بزن.");
        setSelected(bot);
      }
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteTelegramBot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telegram-bots", workspaceId] });
      toast.success("ربات حذف شد.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-7">
      <section className="cortex-panel relative overflow-hidden rounded-[28px] p-5 sm:p-7">
        <div className="absolute -end-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -start-16 -bottom-20 size-56 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="cortex-kicker">TELEGRAM CHANNEL</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">ایجنتت را با چند کلیک روی تلگرام بیاور.</h2>
            <p className="mt-3 text-sm leading-8 text-muted-foreground">Cortex توکن BotFather را سمت سرور رمزنگاری می‌کند، اتصال را تست می‌کند و Webhook را خودکار روی ربات ثبت می‌کند.</p>
          </div>
          <Button onClick={() => setOpen(true)} disabled={agents.length === 0}><Plus />ساخت و اتصال ربات</Button>
        </div>
        {agents.length === 0 && <div className="relative mt-5 rounded-xl border border-amber-300/10 bg-amber-300/[.04] p-3 text-xs leading-6 text-amber-100/80">ابتدا حداقل یک ایجنت بساز تا مقصد ربات مشخص باشد.</div>}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric title="ربات‌ها" value={bots.length} icon={<Bot />} />
        <Metric title="اتصال فعال" value={bots.filter((b) => b.status === "connected").length} icon={<Wifi />} />
        <Metric title="کاربران شناخته‌شده" value={bots.reduce((n, b) => n + b.usersCount, 0)} icon={<Users />} />
      </div>

      {bots.length === 0 ? (
        <Card className="cortex-panel"><CardContent className="py-16 text-center"><Bot className="mx-auto size-12 text-primary/70" /><h3 className="mt-5 text-lg font-semibold">هنوز رباتی متصل نیست</h3><p className="mt-2 text-sm text-muted-foreground">توکن BotFather را وارد کن، ایجنت را انتخاب کن و اتصال را بزن.</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {bots.map((bot) => {
            const meta = statusMeta(bot.status); const Icon = meta.icon;
            return (
              <button key={bot.id} type="button" onClick={() => setSelected(bot)} className="group text-start">
                <Card className="cortex-panel h-full min-h-[250px] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="cortex-icon-box"><Bot /></div>
                        <div className="min-w-0"><p className="truncate font-semibold">{bot.name}</p><p className="truncate text-xs text-muted-foreground">@{bot.username ?? "—"} · {bot.agentName}</p></div>
                      </div>
                      <Badge className={cn("shrink-0 font-normal", meta.className)}><Icon className="size-3.5" />{meta.label}</Badge>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-3"><Mini label="کانال" value="Webhook" /><Mini label="کاربر" value={String(bot.usersCount)} /></div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span>{bot.lastSeenAt ? "آخرین فعالیت: " + new Date(bot.lastSeenAt).toLocaleString("fa-IR") : "هنوز رویدادی ثبت نشده"}</span></div>
                    {bot.lastError && <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs leading-6 text-destructive">{bot.lastError}</p>}
                    <div className="mt-4 flex items-center gap-2 border-t border-white/[.06] pt-3 text-[10px] text-primary"><Pencil className="size-3.5" />مدیریت اتصال، ایجنت و دسترسی</div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-h-[88dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>ساخت و اتصال ربات تلگرام</DialogTitle><DialogDescription>توکن BotFather را وارد کن. Cortex ابتدا اعتبار توکن را بررسی می‌کند و بعد Webhook را ثبت می‌کند.</DialogDescription></DialogHeader>
          <CreateBotForm agents={agents} workspaceId={workspaceId ?? undefined} pending={create.isPending} onSubmit={(value) => create.mutate(value)} />
        </DialogContent>
      </Dialog>

      {selected && <BotDetail bot={selected} agents={agents} onClose={() => setSelected(null)} onUpdated={(bot) => setSelected(bot)} onDelete={() => { del.mutate(selected.id); setSelected(null); }} />}
    </div>
  );
}

function CreateBotForm({ agents, workspaceId, pending, onSubmit }: { agents: AgentDto[]; workspaceId?: string; pending: boolean; onSubmit: (value: { workspaceId?: string; agentId: string; name: string; token: string }) => void }) {
  const [name, setName] = useState("ربات Cortex");
  const [token, setToken] = useState("");
  const [agentId, setAgentId] = useState("");
  const resolvedAgentId = agentId || agents[0]?.id || "";

  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit({ workspaceId, agentId: resolvedAgentId, name: name.trim(), token: token.trim() }); }}>
      <div className="space-y-2"><Label>نام ربات</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثلاً پشتیبان شرکت" /></div>
      <div className="space-y-2"><Label>Bot Token</Label><Input dir="ltr" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="123456:AA..." className="text-left" autoComplete="off" /><p className="text-[11px] leading-5 text-muted-foreground">توکن فقط سمت سرور رمزنگاری و نگهداری می‌شود.</p></div>
      <div className="space-y-2"><Label>ایجنت مقصد</Label><Select value={agentId} onValueChange={setAgentId}><SelectTrigger className="w-full"><SelectValue placeholder="انتخاب ایجنت" /></SelectTrigger><SelectContent>{agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="rounded-xl border border-primary/15 bg-primary/[.05] p-4 text-xs leading-6 text-muted-foreground"><p className="font-semibold text-foreground">Webhook خودکار</p><p className="mt-1">پس از ساخت، Cortex اعتبار توکن و اتصال Webhook را بررسی می‌کند.</p></div>
      <DialogFooter><Button type="submit" disabled={pending || !token.trim() || !resolvedAgentId || !name.trim()}>{pending ? "در حال بررسی و اتصال…" : "ساخت و اتصال"}</Button></DialogFooter>
    </form>
  );
}

function BotDetail({ bot, agents, onClose, onUpdated, onDelete }: { bot: TelegramBotDto; agents: AgentDto[]; onClose: () => void; onUpdated: (bot: TelegramBotDto) => void; onDelete: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(bot.name);
  const [agentId, setAgentId] = useState(bot.agentId);
  const [token, setToken] = useState("");
  const reconnect = useMutation({
    mutationFn: () => api.reconnectTelegramBot(bot.id),
    onSuccess: ({ bot: updated }) => { onUpdated(updated); queryClient.invalidateQueries({ queryKey: ["telegram-bots"] }); toast.success("اتصال Telegram تست و تازه‌سازی شد."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const update = useMutation({
    mutationFn: () => api.updateTelegramBot(bot.id, { name: name.trim(), agentId, ...(token.trim() ? { token: token.trim() } : {}) }),
    onSuccess: ({ bot: updated }) => { onUpdated(updated); setToken(""); queryClient.invalidateQueries({ queryKey: ["telegram-bots"] }); toast.success(updated.status === "connected" ? "تنظیمات ربات و اتصال به‌روز شد." : "تنظیمات ذخیره شد؛ وضعیت اتصال را بررسی کن."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const { data: allowlistData } = useQuery({ queryKey: ["allowlist", bot.id], queryFn: () => api.getTelegramAllowlist(bot.id), enabled: !!bot.id });
  const workspaceId = useCortexStore((s) => s.activeWorkspaceId);
  const usersQuery = useQuery({
    queryKey: ["telegram-users-admin", workspaceId],
    queryFn: () => api.getTelegramUsers(workspaceId ?? undefined),
    enabled: !!workspaceId,
    staleTime: 15_000,
  });
  const botUsers = (usersQuery.data?.users ?? []).filter((item) => item.botId === bot.id).sort((a, b) => (b.usage?.tokens ?? 0) - (a.usage?.tokens ?? 0));
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const addAllow = useMutation({
    mutationFn: () => api.addTelegramAllowlist(bot.id, { phoneNumber: phone, displayName }),
    onSuccess: () => { setPhone(""); setDisplayName(""); queryClient.invalidateQueries({ queryKey: ["allowlist", bot.id] }); toast.success("کاربر به فهرست مجاز اضافه شد."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const removeAllow = useMutation({
    mutationFn: (entryId: string) => api.removeTelegramAllowlist(bot.id, entryId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["allowlist", bot.id] }); toast.success("دسترسی کاربر حذف شد."); },
    onError: (error: Error) => toast.error(error.message),
  });

  const meta = statusMeta(bot.status); const Icon = meta.icon;
  const webhookUrl = typeof window === "undefined" ? "" : window.location.origin + "/api/telegram/webhook/" + bot.id;
  async function copyWebhook() {
    if (!webhookUrl) return;
    try { await navigator.clipboard.writeText(webhookUrl); toast.success("آدرس Webhook کپی شد."); }
    catch { toast.error("کپی آدرس ناموفق بود."); }
  }

  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-h-[90dvh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><DialogTitle className="truncate">{bot.name}</DialogTitle><DialogDescription className="mt-1">مدیریت ایجنت، اتصال، Webhook و دسترسی کاربران.</DialogDescription></div>
            <Badge className={cn("shrink-0 font-normal", meta.className)}><Icon className="size-3.5" />{meta.label}</Badge>
          </div>
        </DialogHeader>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
          <Card className="border-white/[.06] bg-white/[.02]">
            <CardHeader><CardTitle className="text-sm">تنظیمات ربات</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>نام نمایشی</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div>
              <div className="space-y-2"><Label>ایجنت متصل</Label><Select value={agentId} onValueChange={setAgentId}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>توکن جدید (اختیاری)</Label><Input dir="ltr" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="برای نگه‌داشتن توکن فعلی خالی بگذار" className="text-left" autoComplete="off" /></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" disabled={update.isPending || !name.trim() || !agentId} onClick={() => update.mutate()}><Pencil />{update.isPending ? "در حال ذخیره…" : "ذخیره تنظیمات"}</Button>
                <Button variant="outline" className="flex-1" disabled={reconnect.isPending} onClick={() => reconnect.mutate()}>{reconnect.isPending ? <RefreshCw className="animate-spin" /> : <Wifi />}{reconnect.isPending ? "در حال تست…" : "تست و اتصال مجدد"}</Button>
              </div>
              <div className="rounded-xl border border-white/[.06] bg-black/10 p-3">
                <p className="text-[11px] font-medium">Webhook endpoint</p>
                <div className="mt-2 flex items-center gap-2"><Input dir="ltr" readOnly value={webhookUrl} className="min-w-0 text-left text-[11px]" /><Button size="icon" variant="outline" onClick={copyWebhook} aria-label="کپی آدرس Webhook"><Copy /></Button></div>
                <p className="mt-2 text-[10px] leading-5 text-muted-foreground">توکن مخفی هرگز در این URL قرار نمی‌گیرد؛ اعتبارسنجی با secret header انجام می‌شود.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/[.06] bg-white/[.02]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Users className="size-4 text-primary" />دسترسی کاربران</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input dir="ltr" placeholder="+98912..." value={phone} onChange={(event) => setPhone(event.target.value)} /><Input placeholder="نام نمایشی" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /><Button className="sm:self-stretch" disabled={!phone.trim() || addAllow.isPending} onClick={() => addAllow.mutate()}><ShieldCheck />افزودن</Button></div>
              {allowlistData?.entries?.length ? <div className="space-y-2">{allowlistData.entries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[.06] p-3"><div className="min-w-0"><p className="truncate text-sm">{entry.displayName || "بدون نام"}</p><p dir="ltr" className="truncate text-xs text-muted-foreground">{entry.phoneNumber}</p></div><Button size="icon" variant="ghost" className="shrink-0 text-destructive" onClick={() => removeAllow.mutate(entry.id)} aria-label="حذف دسترسی"><Trash2 /></Button></div>)}</div> : <p className="rounded-xl border border-dashed border-white/[.08] p-5 text-center text-xs text-muted-foreground">هنوز کاربری در allowlist نیست.</p>}
              <div className="border-t border-white/[.06] pt-4">
                <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-semibold"><BarChart3 className="size-4 text-primary" />مانیتورینگ مصرف همین ربات</p><span className="text-[10px] text-muted-foreground">{botUsers.length} کاربر شناخته‌شده</span></div>
                <div className="mt-3 space-y-2">
                  {botUsers.slice(0, 5).map((user) => (
                    <div key={user.id} className="rounded-xl border border-white/[.06] bg-black/10 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0"><p className="truncate text-xs font-medium">{[user.firstName,user.lastName].filter(Boolean).join(" ") || user.username || user.telegramUserId}</p><p dir="ltr" className="truncate text-[10px] text-muted-foreground">{user.phoneNumber || "بدون شماره"}</p></div>
                        <span className="shrink-0 text-xs font-semibold text-primary">{faNum(user.usage?.tokens ?? 0)} توکن</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground"><span>امروز: {faNum(user.dailyUsage?.tokens ?? 0)}</span><span>ماه: {faNum(user.monthlyUsage?.tokens ?? 0)}</span><span>سقف روزانه: {user.dailyTokenLimit > 0 ? faNum(user.dailyTokenLimit) : "∞"}</span><span>سقف ماهانه: {user.monthlyTokenLimit > 0 ? faNum(user.monthlyTokenLimit) : "∞"}</span></div>
                    </div>
                  ))}
                  {botUsers.length === 0 && <p className="rounded-xl border border-dashed border-white/[.08] p-4 text-center text-[11px] text-muted-foreground">هنوز مصرفی از این ربات ثبت نشده است.</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {bot.lastError && <div className="rounded-xl border border-destructive/20 bg-destructive/[.05] p-4"><p className="text-xs font-semibold text-destructive">آخرین خطا</p><p className="mt-1 text-xs leading-6 text-destructive/90">{bot.lastError}</p></div>}
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={onClose}><Link2 />بستن</Button>
          <Button variant="destructive" onClick={onDelete}><Trash2 />حذف ربات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return <Card className="cortex-panel"><CardContent className="flex items-center gap-4 p-5"><div className="cortex-icon-box">{icon}</div><div><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{title}</p></div></CardContent></Card>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[.06] bg-black/10 p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}
