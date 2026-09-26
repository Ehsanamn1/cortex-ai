"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Bot, CheckCircle2, Copy, Link2, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, Users, Wifi, XCircle } from "lucide-react";
import { toast } from "sonner";

import { api, type AgentDto, type TelegramBotDto, type TelegramUserDto } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { faNum } from "@/components/cortex/format";

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
  const usersQuery = useQuery({
    queryKey: ["telegram-bot-users", bot.id],
    queryFn: () => api.getTelegramBotUsers(bot.id),
    enabled: !!bot.id,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
  const botUsers = (usersQuery.data?.users ?? []).filter((item) => item.botId === bot.id).sort((a, b) => (b.usage?.tokens ?? 0) - (a.usage?.tokens ?? 0));
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
            <div className="min-w-0"><DialogTitle className="truncate">{bot.name}</DialogTitle><DialogDescription className="mt-1">مدیریت ایجنت، اتصال، Webhook و کاربران عمومی ربات.</DialogDescription></div>
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
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Users className="size-4 text-primary" />دسترسی و کاربران</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[.06] p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><ShieldCheck className="size-4" />دسترسی عمومی فعال است</p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">کاربران برای شروع گفتگو نیازی به تأیید شماره موبایل یا ثبت در فهرست مجاز ندارند. فقط حساب‌هایی که مدیر صراحتاً مسدود کند نمی‌توانند از ربات استفاده کنند.</p>
              </div>
              <div className="border-t border-white/[.06] pt-4">
                <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-semibold"><BarChart3 className="size-4 text-primary" />مانیتورینگ مصرف همین ربات</p><span className="text-[10px] text-muted-foreground">{botUsers.length} کاربر شناخته‌شده</span></div>
                <div className="mt-3 space-y-2">
                  {botUsers.map((user) => (
                    <TelegramUserMonitorCard key={user.id} botId={bot.id} user={user} onChanged={() => void usersQuery.refetch()} />
                  ))}
                  {botUsers.length === 0 && <p className="rounded-xl border border-dashed border-white/[.08] p-4 text-center text-[11px] text-muted-foreground">هنوز کاربری برای این ربات ثبت نشده است.</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <TelegramCustomizer botId={bot.id} />

        {bot.lastError && <div className="rounded-xl border border-destructive/20 bg-destructive/[.05] p-4"><p className="text-xs font-semibold text-destructive">آخرین خطا</p><p className="mt-1 text-xs leading-6 text-destructive/90">{bot.lastError}</p></div>}
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={onClose}><Link2 />بستن</Button>
          <Button variant="destructive" onClick={onDelete}><Trash2 />حذف ربات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TelegramCustomizer({ botId }: { botId: string }) {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["telegram-profile", botId],
    queryFn: () => api.getTelegramBotProfile(botId),
    staleTime: 15_000,
  });
  const profile = q.data?.profile;
  const [welcome, setWelcome] = useState("");
  const [help, setHelp] = useState("");
  const [newChat, setNewChat] = useState("");
  const [newChatButton, setNewChatButton] = useState("");
  const [helpButton, setHelpButton] = useState("");
  const [usageButton, setUsageButton] = useState("");
  const [banner, setBanner] = useState("");
  const [thinking, setThinking] = useState("");
  const [showThinking, setShowThinking] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setWelcome(profile.welcomeText);
    setHelp(profile.helpText);
    setNewChat(profile.newChatText);
    setNewChatButton(profile.newChatButtonText);
    setHelpButton(profile.helpButtonText);
    setUsageButton(profile.usageButtonText);
    setBanner(profile.welcomeBannerUrl ?? "");
    setThinking(profile.thinkingMessages.join("\n"));
    setShowThinking(profile.showThinking);
    setShowBanner(profile.showWelcomeBanner);
  }, [profile]);

  const save = useMutation({
    mutationFn: () => api.updateTelegramBotProfile(botId, {
      welcomeText: welcome.trim(),
      helpText: help.trim(),
      newChatText: newChat.trim(),
      newChatButtonText: newChatButton.trim(),
      helpButtonText: helpButton.trim(),
      usageButtonText: usageButton.trim(),
      welcomeBannerUrl: banner.trim(),
      thinkingMessages: thinking.split("\n").map(v => v.trim()).filter(Boolean),
      showThinking,
      showWelcomeBanner: showBanner,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telegram-profile", botId] });
      toast.success("شخصی‌سازی ربات ذخیره شد.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (q.isLoading || !profile) {
    return <Card className="border-white/[.06] bg-white/[.02]"><CardContent className="p-5 text-sm text-muted-foreground">در حال بارگذاری مرکز شخصی‌سازی…</CardContent></Card>;
  }

  return (
    <Card className="border-primary/15 bg-primary/[.025]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm"><Pencil className="size-4 text-primary" />استودیو شخصی‌سازی ربات</CardTitle>
        <p className="text-xs leading-6 text-muted-foreground">متن‌های خوش‌آمد، راهنما، دکمه‌ها، پیام‌های «در حال کار» و بنر را برای همین ربات تغییر بده. ذخیره‌سازی روی خود Bot Profile انجام می‌شود.</p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2"><Label>متن خوش‌آمدگویی</Label><Textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={4} /></div>
        <div className="space-y-2"><Label>متن راهنما</Label><Textarea value={help} onChange={(e) => setHelp(e.target.value)} rows={4} /></div>
        <div className="space-y-2"><Label>متن New Chat</Label><Textarea value={newChat} onChange={(e) => setNewChat(e.target.value)} rows={4} /></div>
        <div className="space-y-2"><Label>دکمه گفتگوی جدید</Label><Input value={newChatButton} onChange={(e) => setNewChatButton(e.target.value)} /></div>
        <div className="space-y-2"><Label>دکمه راهنما</Label><Input value={helpButton} onChange={(e) => setHelpButton(e.target.value)} /></div>
        <div className="space-y-2"><Label>دکمه مصرف</Label><Input value={usageButton} onChange={(e) => setUsageButton(e.target.value)} /></div>
        <div className="space-y-2"><Label>URL بنر خوش‌آمد (اختیاری)</Label><Input dir="ltr" value={banner} onChange={(e) => setBanner(e.target.value)} placeholder="https://..." /></div>
        <div className="space-y-2 md:col-span-2"><Label>پیام‌های وضعیت کار (هر خط یک پیام)</Label><Textarea value={thinking} onChange={(e) => setThinking(e.target.value)} rows={3} /></div>
        <div className="flex items-center justify-between rounded-xl border border-white/[.06] bg-black/10 p-3"><div><p className="text-xs font-medium">نمایش وضعیت فکر/کار</p><p className="mt-1 text-[10px] text-muted-foreground">پیام مرحله‌ای قبل از پاسخ نمایش داده شود.</p></div><Switch checked={showThinking} onCheckedChange={setShowThinking} /></div>
        <div className="flex items-center justify-between rounded-xl border border-white/[.06] bg-black/10 p-3"><div><p className="text-xs font-medium">نمایش بنر خوش‌آمد</p><p className="mt-1 text-[10px] text-muted-foreground">در /start، بنر https ارسال شود.</p></div><Switch checked={showBanner} onCheckedChange={setShowBanner} /></div>
        <div className="md:col-span-2"><Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "در حال ذخیره…" : "ذخیره شخصی‌سازی"}</Button></div>
      </CardContent>
    </Card>
  );
}

function TelegramUserMonitorCard({ botId, user, onChanged }: { botId: string; user: TelegramUserDto; onChanged: () => void }) {
  const [dailyMessages, setDailyMessages] = useState(String(user.dailyMessageLimit));
  const [monthlyMessages, setMonthlyMessages] = useState(String(user.monthlyMessageLimit));
  const [dailyTokens, setDailyTokens] = useState(String(user.dailyTokenLimit));
  const [monthlyTokens, setMonthlyTokens] = useState(String(user.monthlyTokenLimit));

  const mutation = useMutation({
    mutationFn: (payload: {
      status?: "pending" | "allowed" | "blocked";
      dailyMessageLimit?: number;
      monthlyMessageLimit?: number;
      dailyTokenLimit?: number;
      monthlyTokenLimit?: number;
    }) => api.updateTelegramBotUser(botId, user.id, payload.status, {
      dailyMessageLimit: payload.dailyMessageLimit,
      monthlyMessageLimit: payload.monthlyMessageLimit,
      dailyTokenLimit: payload.dailyTokenLimit,
      monthlyTokenLimit: payload.monthlyTokenLimit,
    }),
    onSuccess: () => { onChanged(); toast.success("دسترسی و سقف مصرف کاربر به‌روز شد."); },
    onError: (error: Error) => toast.error(error.message),
  });

  function numberValue(value: string) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.min(10_000_000, Math.floor(number)) : 0;
  }

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || user.telegramUserId;
  return (
    <div className="rounded-xl border border-white/[.06] bg-black/10 p-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-xs font-medium">{displayName}</p>
              <Badge className={cn(
                "font-normal",
                user.status === "allowed"
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                  : user.status === "blocked"
                    ? "border-destructive/20 bg-destructive/10 text-destructive"
                    : "border-amber-400/20 bg-amber-400/10 text-amber-200"
              )}>{user.status === "allowed" ? "مجاز" : user.status === "blocked" ? "مسدود" : "در انتظار"}</Badge>
            </div>
            <p dir="ltr" className="mt-1 truncate text-[10px] text-muted-foreground">
              {user.phoneNumber || "بدون شماره"} · TG {user.telegramUserId}
            </p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-primary">{faNum(user.usage?.tokens ?? 0)} توکن کل</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
          <span>امروز: {faNum(user.dailyUsage?.tokens ?? 0)} توکن</span>
          <span>ماه: {faNum(user.monthlyUsage?.tokens ?? 0)} توکن</span>
          <span>پیام امروز: {faNum(user.dailyUsage?.events ?? 0)}</span>
          <span>پیام ماه: {faNum(user.monthlyUsage?.events ?? 0)}</span>
          <span>آخرین فعالیت: {user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString("fa-IR") : "—"}</span>
          <span>هزینه برآوردی: {faNum(user.usage?.estimatedCostMicros ?? 0)}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Input inputMode="numeric" value={dailyMessages} onChange={(e) => setDailyMessages(e.target.value)} placeholder="پیام/روز" aria-label="سقف پیام روزانه" />
          <Input inputMode="numeric" value={monthlyMessages} onChange={(e) => setMonthlyMessages(e.target.value)} placeholder="پیام/ماه" aria-label="سقف پیام ماهانه" />
          <Input inputMode="numeric" value={dailyTokens} onChange={(e) => setDailyTokens(e.target.value)} placeholder="توکن/روز" aria-label="سقف توکن روزانه" />
          <Input inputMode="numeric" value={monthlyTokens} onChange={(e) => setMonthlyTokens(e.target.value)} placeholder="توکن/ماه" aria-label="سقف توکن ماهانه" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({
            status: "allowed",
            dailyMessageLimit: numberValue(dailyMessages),
            monthlyMessageLimit: numberValue(monthlyMessages),
            dailyTokenLimit: numberValue(dailyTokens),
            monthlyTokenLimit: numberValue(monthlyTokens),
          })}><ShieldCheck />اجازه و ذخیره</Button>
          <Button size="sm" variant="ghost" className="text-destructive" disabled={mutation.isPending} onClick={() => mutation.mutate({
            status: "blocked",
            dailyMessageLimit: numberValue(dailyMessages),
            monthlyMessageLimit: numberValue(monthlyMessages),
            dailyTokenLimit: numberValue(dailyTokens),
            monthlyTokenLimit: numberValue(monthlyTokens),
          })}><XCircle />مسدود کردن</Button>
        </div>
      </div>
    </div>
  );
}

function Metric({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return <Card className="cortex-panel"><CardContent className="flex items-center gap-4 p-5"><div className="cortex-icon-box">{icon}</div><div><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{title}</p></div></CardContent></Card>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[.06] bg-black/10 p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}
