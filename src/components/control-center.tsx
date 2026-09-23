"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Bot, Database, FileCog, LogOut, MessageSquare, Plug, Save, Send, ShieldCheck, Users, Workflow, Puzzle, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Metrics = { users:number; workspaces:number; agents:number; knowledge:number; conversations:number; messages:number; bots:number; providers:number; events:number; logs:number };
type Summary = {
  admin: string;
  metrics: Metrics;
  recentAgents: Array<{id:string;name:string;status:string;createdAt:string;workspace:{name:string}}>;
  recentUsers: Array<{id:string;name:string|null;email:string;createdAt:string}>;
  recentConversations: Array<{id:string;title:string;channel:string;updatedAt:string;agent:{name:string}}>;
};
type Settings = Record<string,string>;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "خطا");
  return payload as T;
}

function Kpi({icon:Icon,label,value,detail}:{icon:typeof Bot;label:string;value:number;detail:string}) {
  return <Card className="cortex-panel rounded-2xl"><CardContent className="p-5"><div className="flex items-start justify-between gap-4"><span className="cortex-icon-box"><Icon className="size-[18px]"/></span><span className="text-xs text-muted-foreground">{detail}</span></div><p className="mt-5 text-3xl font-bold">{value.toLocaleString("fa-IR")}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></CardContent></Card>;
}

function LoginCard({onDone}:{onDone:()=>void}) {
  const [username,setUsername]=useState("admin");
  const [password,setPassword]=useState("");
  const login=useMutation({
    mutationFn:()=>fetchJson<{ok:boolean}>("/api/admin/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})}),
    onSuccess:()=>{onDone();toast.success("ورود مدیر انجام شد");},
    onError:(e:Error)=>toast.error(e.message)
  });
  return <div className="min-h-screen flex items-center justify-center bg-background px-6"><Card className="cortex-panel w-full max-w-md rounded-[28px]"><CardHeader className="p-7"><div className="flex items-center gap-3"><ShieldCheck className="size-6 text-primary"/><div><CardTitle>مرکز مدیریت</CardTitle><p className="mt-1 text-xs text-muted-foreground">ورود اختصاصی مدیر محصول</p></div></div></CardHeader><CardContent className="space-y-5 p-7 pt-0"><div className="space-y-2"><Label>نام کاربری</Label><Input dir="ltr" value={username} onChange={e=>setUsername(e.target.value)}/></div><div className="space-y-2"><Label>رمز عبور</Label><Input dir="ltr" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login.mutate()}/></div><Button className="w-full" disabled={!username||!password||login.isPending} onClick={()=>login.mutate()}>{login.isPending?"در حال ورود…":"ورود به پنل"}</Button><p className="text-[11px] leading-5 text-muted-foreground">برای محیط واقعی، رمز پیش‌فرض را با متغیر CORTEX_ADMIN_PASSWORD در تنظیمات محیط تغییر دهید.</p></CardContent></Card></div>;
}

export function ControlCenter() {
  const qc=useQueryClient();
  const session=useQuery<{username:string}>({queryKey:["cc-auth"],queryFn:()=>fetchJson<{username:string}>("/api/admin/auth/me"),retry:false});
  const summary=useQuery<Summary>({queryKey:["cc-summary"],queryFn:()=>fetchJson<Summary>("/api/control-center"),enabled:session.isSuccess});
  const settingsQ=useQuery<{settings:Settings}>({queryKey:["cc-settings"],queryFn:()=>fetchJson<{settings:Settings}>("/api/control-center/settings"),enabled:session.isSuccess});
  const [draftSettings,setDraftSettings]=useState<Settings>({});
  const settings:Settings={...(settingsQ.data?.settings??{}),...draftSettings};
  const updateSetting=(key:string,value:string)=>setDraftSettings(prev=>({...prev,[key]:value}));
  const save=useMutation({mutationFn:()=>fetchJson<{settings:Settings}>("/api/control-center/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({settings})}),onSuccess:()=>{qc.invalidateQueries({queryKey:["cc-settings"]});toast.success("تنظیمات ذخیره شد")},onError:(e:Error)=>toast.error(e.message)});
  const logout=useMutation({mutationFn:()=>fetch("/api/admin/auth/logout",{method:"POST"}),onSuccess:()=>{qc.clear();window.location.reload()}});
  const m=summary.data?.metrics;
  const pluginsQ=useQuery<{plugins:Array<{id:string;key:string;name:string;description:string|null;version:string;enabled:boolean}>}>({queryKey:["cc-plugins"],queryFn:()=>fetchJson<{plugins:Array<{id:string;key:string;name:string;description:string|null;version:string;enabled:boolean}>}>("/api/control-center/plugins"),enabled:session.isSuccess});
  const pluginToggle=useMutation({mutationFn:(v:{id:string;enabled:boolean})=>fetchJson<{plugin:unknown}>("/api/control-center/plugins",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(v)}),onSuccess:()=>{qc.invalidateQueries({queryKey:["cc-plugins"]});toast.success("وضعیت افزونه تغییر کرد")},onError:(e:Error)=>toast.error(e.message)});

  if(session.isPending)return <div className="min-h-screen bg-background p-8"><Skeleton className="mx-auto h-40 max-w-6xl rounded-3xl"/></div>;
  if(session.isError)return <LoginCard onDone={()=>void session.refetch()}/>;

  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-30 border-b border-white/[.06] bg-[#07090d]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <div><p className="text-[10px] font-bold tracking-[.24em] text-primary">CONTROL CENTER</p><h1 className="mt-1 text-xl font-bold">مرکز مدیریت Cortex</h1></div>
        <div className="flex items-center gap-2"><span className="hidden rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300 sm:inline-flex">مدیر: {session.data?.username}</span><Button variant="outline" size="sm" onClick={()=>logout.mutate()}><LogOut/> خروج</Button></div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl space-y-7 px-5 py-6 lg:px-8 lg:py-8">
      <section className="cortex-hero relative overflow-hidden rounded-[30px] border border-white/[.08]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_16%,rgba(59,130,255,.16),transparent_28%),radial-gradient(circle_at_20%_78%,rgba(139,92,246,.12),transparent_25%),linear-gradient(145deg,#111824,#070a0f)]"/>
        <div className="relative z-10 grid gap-6 p-6 lg:grid-cols-[1.35fr_.65fr] lg:p-8">
          <div><p className="cortex-kicker">دید کامل سیستم</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">همه‌چیز یکجا، بدون پنل شلوغ.</h2><p className="mt-3 max-w-2xl text-sm leading-8 text-slate-300">کاربران، فضاها، ایجنت‌ها، دانش، گفتگوها، تلگرام، سرویس‌های مدل، مصرف و تنظیمات محصول را از همین‌جا زیرنظر بگیر.</p></div>
          <div className="grid grid-cols-2 gap-3 self-end"><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-xs text-muted-foreground">رویدادها</p><p className="mt-2 text-2xl font-bold">{(m?.events??0).toLocaleString("fa-IR")}</p></div><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-xs text-muted-foreground">لاگ‌ها</p><p className="mt-2 text-2xl font-bold">{(m?.logs??0).toLocaleString("fa-IR")}</p></div></div>
        </div>
      </section>

      {m && <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi icon={Users} label="کاربران" value={m.users} detail="حساب‌های ثبت‌شده"/><Kpi icon={Workflow} label="فضاهای کاری" value={m.workspaces} detail="Workspace"/><Kpi icon={Bot} label="ایجنت‌ها" value={m.agents} detail="Agent"/><Kpi icon={Database} label="منابع دانش" value={m.knowledge} detail="Knowledge"/></section>}
      {m && <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Kpi icon={MessageSquare} label="گفتگوها" value={m.conversations} detail="Conversation"/><Kpi icon={Activity} label="پیام‌ها" value={m.messages} detail="Message"/><Kpi icon={Send} label="ربات‌ها" value={m.bots} detail="Telegram"/><Kpi icon={Plug} label="اتصال مدل" value={m.providers} detail="Provider config"/><Kpi icon={FileCog} label="رخدادها" value={m.events} detail="Usage"/></section>}

      <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="cortex-panel rounded-2xl"><CardHeader><CardTitle className="text-base">جدیدترین ایجنت‌ها</CardTitle></CardHeader><CardContent className="p-0"><div className="divide-y divide-white/[.06]">{(summary.data?.recentAgents??[]).map(a=><div key={a.id} className="flex items-center gap-3 p-4"><span className="cortex-icon-box"><Bot/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{a.name}</p><p className="mt-1 text-xs text-muted-foreground">{a.workspace.name} · {a.status}</p></div><span className="text-[11px] text-muted-foreground">{new Date(a.createdAt).toLocaleDateString("fa-IR")}</span></div>)}</div></CardContent></Card>
        <Card className="cortex-panel rounded-2xl"><CardHeader><CardTitle className="text-base">کاربران جدید</CardTitle></CardHeader><CardContent className="p-0"><div className="divide-y divide-white/[.06]">{(summary.data?.recentUsers??[]).map(u=><div key={u.id} className="flex items-center gap-3 p-4"><span className="flex size-10 items-center justify-center rounded-xl border bg-primary/10 text-primary"><Users/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{u.name||"بدون نام"}</p><p dir="ltr" className="truncate text-xs text-muted-foreground">{u.email}</p></div></div>)}</div></CardContent></Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Card className="cortex-panel rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Puzzle className="size-4 text-primary"/>افزونه‌های فعال</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(pluginsQ.data?.plugins??[]).length===0
              ? <p className="py-10 text-center text-sm text-muted-foreground">هنوز افزونه‌ای ثبت نشده است.</p>
              : (pluginsQ.data?.plugins??[]).map(plugin=><div key={plugin.id} className="flex items-center gap-3 rounded-xl border border-white/[.06] p-3">
                  <span className="flex size-9 items-center justify-center rounded-lg border bg-primary/10 text-primary"><Puzzle/></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{plugin.name}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{plugin.key} · v{plugin.version}</p></div>
                  <Button size="icon" variant="ghost" title={plugin.enabled?"غیرفعال کردن":"فعال کردن"} onClick={()=>pluginToggle.mutate({id:plugin.id,enabled:!plugin.enabled})}><Power className={plugin.enabled?"text-emerald-400":"text-muted-foreground"}/></Button>
                </div>)
            }
            <p className="text-[10px] leading-5 text-muted-foreground">این بخش رجیستری و فعال/غیرفعال‌سازی افزونه‌ها را مدیریت می‌کند؛ اجرای کد دلخواه از داخل پنل عمداً مستقیم و بدون sandbox انجام نمی‌شود.</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Card className="cortex-panel rounded-2xl"><CardHeader><CardTitle className="text-base">گفتگوهای اخیر</CardTitle></CardHeader><CardContent className="p-0"><div className="divide-y divide-white/[.06]">{(summary.data?.recentConversations??[]).map(c=><div key={c.id} className="p-4"><p className="truncate text-sm font-semibold">{c.title}</p><p className="mt-1 text-xs text-muted-foreground">{c.agent.name} · {c.channel} · {new Date(c.updatedAt).toLocaleString("fa-IR")}</p></div>)}</div></CardContent></Card>
        <Card className="cortex-panel rounded-2xl"><CardHeader><CardTitle className="text-base">تنظیمات قابل ویرایش محصول</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
          <div><Label>نام محصول</Label><Input className="mt-2" value={settings["site.name"]||""} onChange={e=>updateSetting("site.name",e.target.value)}/></div>
          <div><Label>حداکثر فایل دانش (MB)</Label><Input min={1} max={200} type="number" className="mt-2" value={settings["site.maxUploadMb"]||"200"} onChange={e=>updateSetting("site.maxUploadMb",e.target.value)}/></div>
          <div className="sm:col-span-2"><Label>عنوان خوش‌آمدگویی</Label><Input className="mt-2" value={settings["site.welcomeTitle"]||""} onChange={e=>updateSetting("site.welcomeTitle",e.target.value)}/></div>
          <div className="sm:col-span-2"><Label>توضیحات محصول</Label><Input className="mt-2" value={settings["site.description"]||""} onChange={e=>updateSetting("site.description",e.target.value)}/></div>
          <div className="sm:col-span-2"><Label>ایمیل پشتیبانی</Label><Input dir="ltr" className="mt-2 text-left" value={settings["site.supportEmail"]||""} onChange={e=>updateSetting("site.supportEmail",e.target.value)}/></div>
          <div className="sm:col-span-2 flex justify-end"><Button onClick={()=>save.mutate()} disabled={save.isPending}><Save/>{save.isPending?"در حال ذخیره…":"ذخیره تنظیمات"}</Button></div>
        </CardContent></Card>
      </section>
    </main>
  </div>;
}
