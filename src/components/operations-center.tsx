"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, Plus, RefreshCw, Search, ShieldCheck, Trash2, UserRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AdminTelegramUser = {
  id:string; botId:string; telegramUserId:string; phoneNumber:string|null; username:string|null; firstName:string|null; lastName:string|null; status:string;
  dailyTokenLimit:number; monthlyTokenLimit:number; lastSeenAt:string|null; createdAt:string;
  bot:{id:string;name:string;workspaceId:string;username:string|null};
  usage:{events:number;tokens:number;inputTokens:number;outputTokens:number;estimatedCostMicros:number;lastUsedAt:string|null};
  dailyUsage:{events:number;tokens:number}; monthlyUsage:{events:number;tokens:number};
};
type AllowEntry={id:string;botId:string;phoneNumber:string;displayName:string|null;notes:string|null;status:string;createdAt:string;updatedAt:string;bot:{id:string;name:string;username:string|null}};
type AdminTelegramData={users:AdminTelegramUser[];allowlist:AllowEntry[]};
type KnowledgeSource={id:string;name:string;type:string;status:string;error:string|null;createdAt:string;updatedAt:string;agent:{id:string;name:string;workspaceId:string;workspace:{name:string}};chunkCount:number;documents:Array<{id:string;name:string;mimeType:string|null;sizeBytes:number|null;status:string;error:string|null;chunkCount:number;hasStoredPayload:boolean}>};

async function json<T>(url:string,init?:RequestInit):Promise<T>{
  const res=await fetch(url,{credentials:"same-origin",...init});
  const body=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error((body as {error?:string}).error||"خطا");
  return body as T;
}
const fa=(n:number)=>n.toLocaleString("fa-IR");
const kb=(bytes:number|null|undefined)=>{if(!bytes)return"—";if(bytes<1024*1024)return Math.max(1,Math.round(bytes/1024))+" KB";return(bytes/(1024*1024)).toFixed(1)+" MB";};
const userName=(u:AdminTelegramUser)=>[u.firstName,u.lastName].filter(Boolean).join(" ")||u.username||"کاربر تلگرام";
function statusMeta(s:string){if(s==="allowed")return{label:"مجاز",cls:"border-emerald-400/20 bg-emerald-400/10 text-emerald-300",icon:CheckCircle2};if(s==="blocked")return{label:"مسدود",cls:"border-destructive/20 bg-destructive/10 text-destructive",icon:XCircle};return{label:"در انتظار",cls:"border-amber-400/20 bg-amber-400/10 text-amber-200",icon:ShieldCheck};}

export function OperationsCenter(){
  const qc=useQueryClient();
  const [userSearch,setUserSearch]=useState("");
  const [knowledgeSearch,setKnowledgeSearch]=useState("");
  const [botId,setBotId]=useState("");
  const [phone,setPhone]=useState("");
  const [displayName,setDisplayName]=useState("");
  const [drafts,setDrafts]=useState<Record<string,{dailyTokenLimit:number;monthlyTokenLimit:number}>>({});

  const tg=useQuery<AdminTelegramData>({queryKey:["admin-telegram-users"],queryFn:()=>json<AdminTelegramData>("/api/admin/telegram-users"),refetchInterval:15000});
  const bots=useQuery<{bots:Array<{id:string;name:string;username:string|null}>}>({queryKey:["admin-telegram-bots"],queryFn:()=>json("/api/admin/telegram-bots"),refetchInterval:30000});
  const knowledge=useQuery<{sources:KnowledgeSource[]}>({queryKey:["admin-knowledge"],queryFn:()=>json("/api/admin/knowledge"),refetchInterval:(q)=>q.state.data?.sources.some(s=>s.status==="pending"||s.status==="processing")?5000:false});

  const filteredUsers=useMemo(()=>{
    const q=userSearch.trim().toLocaleLowerCase();
    return (tg.data?.users??[]).filter(u=>!q||[userName(u),u.phoneNumber,u.username,u.bot.name].filter(Boolean).join(" ").toLocaleLowerCase().includes(q));
  },[tg.data?.users,userSearch]);
  const filteredKnowledge=useMemo(()=>{
    const q=knowledgeSearch.trim().toLocaleLowerCase();
    return (knowledge.data?.sources??[]).filter(s=>!q||[s.name,s.agent.name,s.agent.workspace.name].join(" ").toLocaleLowerCase().includes(q));
  },[knowledge.data?.sources,knowledgeSearch]);

  const authorize=useMutation({
    mutationFn:()=>json("/api/admin/telegram-users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({botId,phoneNumber:phone,displayName})}),
    onSuccess:()=>{setPhone("");setDisplayName("");qc.invalidateQueries({queryKey:["admin-telegram-users"]});toast.success("شماره به فهرست مجاز اضافه شد.")},
    onError:(e:Error)=>toast.error(e.message),
  });
  const updateUser=useMutation({
    mutationFn:(v:{id:string;status:string;dailyTokenLimit:number;monthlyTokenLimit:number})=>json("/api/admin/telegram-users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(v)}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:["admin-telegram-users"]});toast.success("دسترسی و محدودیت ذخیره شد.")},
    onError:(e:Error)=>toast.error(e.message),
  });
  const removeAllow=useMutation({
    mutationFn:(id:string)=>json("/api/admin/telegram-users?id="+encodeURIComponent(id),{method:"DELETE"}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:["admin-telegram-users"]});toast.success("شماره از فهرست مجاز حذف شد.")},
    onError:(e:Error)=>toast.error(e.message),
  });
  const knowledgeAction=useMutation({
    mutationFn:(v:{id:string;action:"retry"|"delete"})=>v.action==="delete"
      ?json("/api/admin/knowledge?sourceId="+encodeURIComponent(v.id),{method:"DELETE"})
      :json("/api/admin/knowledge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sourceId:v.id,action:"retry"})}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:["admin-knowledge"]});toast.success("عملیات دانش انجام شد.")},
    onError:(e:Error)=>toast.error(e.message),
  });

  const getDraft=(u:AdminTelegramUser)=>drafts[u.id]??{dailyTokenLimit:u.dailyTokenLimit,monthlyTokenLimit:u.monthlyTokenLimit};
  const setDraft=(id:string,key:"dailyTokenLimit"|"monthlyTokenLimit",value:string)=>{
    const numeric=Math.max(0,Math.min(10000000,Number(value)||0));
    setDrafts(prev=>{
      const current=prev[id]??(() => { const found=(tg.data?.users??[]).find(u=>u.id===id); return {dailyTokenLimit:found?.dailyTokenLimit??0,monthlyTokenLimit:found?.monthlyTokenLimit??0}; })();
      return {...prev,[id]:{...current,[key]:numeric}};
    });
  };

  const allowedCount=tg.data?.users.filter(u=>u.status==="allowed").length??0;
  const blockedCount=tg.data?.users.filter(u=>u.status==="blocked").length??0;
  const totalTokens=tg.data?.users.reduce((n,u)=>n+u.usage.tokens,0)??0;

  return <section className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-[10px] font-bold tracking-[.2em] text-primary">OPERATIONS</p><h2 className="mt-2 text-2xl font-bold">مدیریت کاربران تلگرام و دانش</h2><p className="mt-1 text-sm leading-7 text-muted-foreground">شماره‌ها را قبل از ورود ثبت کن، مصرف توکن هر کاربر را ببین و محدودیت را مستقیم از پنل کنترل کن.</p></div>
      <div className="flex flex-wrap gap-2"><Badge variant="outline">مجاز: {fa(allowedCount)}</Badge><Badge variant="outline">مسدود: {fa(blockedCount)}</Badge><Badge variant="outline">کل توکن ثبت‌شده: {fa(totalTokens)}</Badge></div>
    </div>

    <Card className="cortex-panel rounded-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-primary"/>ثبت شماره مجاز</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <Select value={botId} onValueChange={setBotId}><SelectTrigger><SelectValue placeholder="انتخاب ربات"/></SelectTrigger><SelectContent>{(bots.data?.bots??[]).map(b=><SelectItem key={b.id} value={b.id}>{b.name}{b.username?" (@"+b.username+")":""}</SelectItem>)}</SelectContent></Select>
        <Input dir="ltr" placeholder="+98912..." value={phone} onChange={e=>setPhone(e.target.value)}/>
        <Input placeholder="نام نمایشی (اختیاری)" value={displayName} onChange={e=>setDisplayName(e.target.value)}/>
        <Button disabled={!botId||!phone.trim()||authorize.isPending} onClick={()=>authorize.mutate()}><Plus/>{authorize.isPending?"در حال ثبت…":"افزودن شماره"}</Button>
      </CardContent>
    </Card>

    <Card className="cortex-panel rounded-2xl">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><UserRound className="size-4 text-primary"/>مانیتورینگ مصرف کاربران</CardTitle>
          <div className="relative w-full sm:w-72"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder="نام، شماره یا ربات" className="ps-9"/></div>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">مصرف امروز، این ماه و کل از UsageEvent واقعی محاسبه می‌شود.</p>
      </CardHeader>
      <CardContent className="p-0">
        {tg.isPending?<div className="p-6"><Skeleton className="h-56 w-full rounded-xl"/></div>:filteredUsers.length===0?<div className="py-14 text-center text-sm text-muted-foreground">کاربری پیدا نشد.</div>:
        <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-sm"><thead className="bg-white/[.02] text-[11px] text-muted-foreground"><tr>
          <th className="p-3 text-start">کاربر</th><th className="p-3 text-start">وضعیت</th><th className="p-3 text-start">امروز</th><th className="p-3 text-start">ماه</th><th className="p-3 text-start">کل</th><th className="p-3 text-start">سقف روزانه</th><th className="p-3 text-start">سقف ماهانه</th><th className="p-3 text-end">اقدام</th>
        </tr></thead><tbody className="divide-y divide-white/[.06]">
          {filteredUsers.map(u=>{const meta=statusMeta(u.status);const Icon=meta.icon;const d=getDraft(u);return <tr key={u.id} className="align-top">
            <td className="p-3"><div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-lg border bg-primary/10 text-primary"><UserRound className="size-4"/></span><div><p className="font-medium">{userName(u)}</p><p dir="ltr" className="text-[11px] text-muted-foreground">{u.phoneNumber||"شماره ثبت نشده"}{u.username?" · @"+u.username:""}</p><p className="text-[10px] text-muted-foreground">{u.bot.name}</p></div></div></td>
            <td className="p-3"><Badge className={cn("font-normal",meta.cls)}><Icon className="size-3.5"/>{meta.label}</Badge></td>
            <td className="p-3"><p className="font-semibold">{fa(u.dailyUsage.tokens)}</p><p className="text-[10px] text-muted-foreground">{fa(u.dailyUsage.events)} رخداد</p></td>
            <td className="p-3"><p className="font-semibold">{fa(u.monthlyUsage.tokens)}</p><p className="text-[10px] text-muted-foreground">{fa(u.monthlyUsage.events)} رخداد</p></td>
            <td className="p-3"><p className="font-semibold">{fa(u.usage.tokens)}</p><p className="text-[10px] text-muted-foreground">{fa(u.usage.events)} رخداد</p></td>
            <td className="p-3"><Input type="number" min={0} max={10000000} value={d.dailyTokenLimit} onChange={e=>setDraft(u.id,"dailyTokenLimit",e.target.value)} className="h-9 w-32"/></td>
            <td className="p-3"><Input type="number" min={0} max={10000000} value={d.monthlyTokenLimit} onChange={e=>setDraft(u.id,"monthlyTokenLimit",e.target.value)} className="h-9 w-32"/></td>
            <td className="p-3 text-end"><div className="flex justify-end gap-1"><Button size="sm" onClick={()=>updateUser.mutate({id:u.id,status:"allowed",dailyTokenLimit:d.dailyTokenLimit,monthlyTokenLimit:d.monthlyTokenLimit})} disabled={updateUser.isPending}><CheckCircle2/>مجاز</Button><Button size="sm" variant="outline" onClick={()=>updateUser.mutate({id:u.id,status:"blocked",dailyTokenLimit:d.dailyTokenLimit,monthlyTokenLimit:d.monthlyTokenLimit})} disabled={updateUser.isPending}><XCircle/>مسدود</Button></div></td>
          </tr>})}
        </tbody></table></div>}
      </CardContent>
    </Card>

    <Card className="cortex-panel rounded-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-primary"/>فهرست شماره‌های مجاز</CardTitle><p className="text-xs leading-6 text-muted-foreground">کاربر فقط وقتی اجازه استفاده می‌گیرد که شماره Contact او با این فهرست تطبیق داشته باشد.</p></CardHeader>
      <CardContent className="p-0">{(tg.data?.allowlist??[]).length===0?<div className="py-12 text-center text-sm text-muted-foreground">هنوز شماره‌ای ثبت نشده است.</div>:<div className="divide-y divide-white/[.06]">{tg.data.allowlist.map(e=><div key={e.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-medium">{e.displayName||"بدون نام"}</p><p dir="ltr" className="text-xs text-muted-foreground">{e.phoneNumber} · {e.bot.name}</p></div><Badge variant="outline">{e.status==="allowed"?"مجاز":e.status}</Badge><Button size="icon" variant="ghost" className="self-end text-destructive sm:self-auto" onClick={()=>removeAllow.mutate(e.id)} aria-label="حذف شماره"><Trash2 className="size-4"/></Button></div>)}</div>}</CardContent>
    </Card>

    <Card className="cortex-panel rounded-2xl">
      <CardHeader className="space-y-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="flex items-center gap-2 text-base"><FileText className="size-4 text-primary"/>مدیریت فایل‌های دانش</CardTitle><div className="relative w-full sm:w-72"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={knowledgeSearch} onChange={e=>setKnowledgeSearch(e.target.value)} placeholder="فایل، ایجنت یا فضای کاری" className="ps-9"/></div></div><p className="text-xs leading-6 text-muted-foreground">لیست از دیتابیس واقعی خوانده می‌شود؛ Retry پردازش واقعی را دوباره اجرا می‌کند و حذف منبع، داده مرتبط و فایل ذخیره‌شده را پاک می‌کند.</p></CardHeader>
      <CardContent className="p-0">{knowledge.isPending?<div className="p-6"><Skeleton className="h-56 w-full rounded-xl"/></div>:filteredKnowledge.length===0?<div className="py-14 text-center text-sm text-muted-foreground">فایل یا منبعی پیدا نشد.</div>:<div className="overflow-x-auto"><table className="w-full min-w-[880px] text-sm"><thead className="bg-white/[.02] text-[11px] text-muted-foreground"><tr><th className="p-3 text-start">منبع</th><th className="p-3 text-start">ایجنت / فضا</th><th className="p-3 text-start">وضعیت</th><th className="p-3 text-start">حجم</th><th className="p-3 text-start">Chunk</th><th className="p-3 text-end">اقدام</th></tr></thead><tbody className="divide-y divide-white/[.06]">{filteredKnowledge.map(s=>{const processing=s.status==="processing"||s.status==="pending";return <tr key={s.id}><td className="p-3"><p className="font-medium">{s.name}</p><p className="text-[10px] text-muted-foreground">{s.type==="url"?"URL":"FILE"} · {new Date(s.createdAt).toLocaleString("fa-IR")}</p>{s.error&&<p className="mt-1 text-[10px] text-destructive">{s.error}</p>}</td><td className="p-3"><p>{s.agent.name}</p><p className="text-[10px] text-muted-foreground">{s.agent.workspace.name}</p></td><td className="p-3"><Badge variant="outline">{s.status}</Badge></td><td className="p-3">{kb(s.documents[0]?.sizeBytes)}</td><td className="p-3">{fa(s.chunkCount)}</td><td className="p-3 text-end"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={processing||knowledgeAction.isPending} onClick={()=>knowledgeAction.mutate({id:s.id,action:"retry"})}><RefreshCw className={cn(processing&&"animate-spin")}/>Retry</Button><Button size="sm" variant="destructive" disabled={knowledgeAction.isPending} onClick={()=>knowledgeAction.mutate({id:s.id,action:"delete"})}><Trash2/>حذف</Button></div></td></tr>})}</tbody></table></div>}</CardContent>
    </Card>
  </section>;
}
