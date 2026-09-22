"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, CircleDollarSign, Database, HelpCircle, MessageSquare, Send, Sparkles, Users } from "lucide-react";
import { api } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { faNum } from "@/components/cortex/format";

function K({title,value,detail,icon:Icon}:{title:string;value:string;detail:string;icon:typeof Activity}){
  return <Card className="cortex-panel rounded-2xl"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><span className="cortex-icon-box"><Icon className="size-[18px]"/></span><span className="text-[10px] text-muted-foreground">{detail}</span></div><p className="mt-5 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{title}</p></CardContent></Card>;
}

export function AnalyticsView(){
  const ws=useCortexStore(s=>s.activeWorkspaceId);
  const {data,isPending,isError,error,refetch}=useQuery({queryKey:["analytics",ws],queryFn:()=>api.getAnalytics(ws??undefined),enabled:!!ws});
  const trend=useMemo(()=>{
    if(!data) return [];
    const byDate=new Map(data.trend.map(v=>[v.date,v]));
    const days=[]; const now=new Date();
    for(let i=13;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);const date=d.toISOString().slice(0,10);days.push(byDate.get(date)??{date,messages:0,tokens:0});}
    return days;
  },[data]);
  if(isPending)return <div className="space-y-5"><div className="h-36 animate-pulse rounded-[28px] bg-muted"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4}).map((_,i)=><div key={i} className="h-28 animate-pulse rounded-2xl bg-muted"/>)}</div></div>;
  if(isError||!data)return <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6"><p className="font-semibold">تحلیل در دسترس نیست.</p><p className="mt-2 text-sm text-muted-foreground">{error instanceof Error?error.message:"خطا در دریافت تحلیل"}</p><button className="mt-4 text-sm text-primary" onClick={()=>void refetch()}>تلاش دوباره</button></div>;

  const totalQuestions=data.topQuestions.reduce((n,q)=>n+q.count,0);
  const unansweredRate=totalQuestions?Math.min(100,Math.round((data.unanswered/Math.max(totalQuestions,1))*100)):0;
  const maxMessages=Math.max(...trend.map(x=>x.messages),1);

  return <div className="space-y-7">
    <section className="cortex-panel relative overflow-hidden rounded-[28px] p-6 sm:p-8">
      <div className="absolute -end-20 -top-28 size-72 rounded-full bg-primary/10 blur-3xl"/>
      <div className="absolute -start-10 -bottom-28 size-64 rounded-full bg-violet-500/10 blur-3xl"/>
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="cortex-kicker">هوش و بینش</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">آنچه واقعاً در سیستم اتفاق می‌افتد.</h2><p className="mt-3 max-w-2xl text-sm leading-8 text-muted-foreground">این صفحه از پیام‌ها، رویدادهای مصرف و داده‌های واقعی فضای کاری ساخته می‌شود؛ نه داده آزمایشی.</p></div>
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-300"><span className="font-semibold">زنده</span><span className="mx-2 text-emerald-300/40">•</span>محاسبه بر اساس داده‌های فعلی</div>
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <K title="رویداد استفاده" value={faNum(data.usage.events)} detail="کل" icon={Activity}/>
      <K title="توکن مصرف‌شده" value={faNum(data.usage.tokens)} detail={`ورودی ${faNum(data.usage.inputTokens)}`} icon={Sparkles}/>
      <K title="هزینه ثبت‌شده" value={faNum(data.usage.estimatedCostMicros)} detail="میکرو" icon={CircleDollarSign}/>
      <K title="پرسش‌های بدون پاسخ کافی" value={faNum(data.unanswered)} detail={faNum(unansweredRate)+"٪ از پرسش‌ها"} icon={HelpCircle}/>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <Card className="cortex-panel rounded-2xl"><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4 text-primary"/>روند ۱۴ روزه</CardTitle><span className="text-[10px] text-muted-foreground">پیام‌ها و فعالیت</span></div></CardHeader><CardContent><div className="flex h-64 items-end gap-1.5">{trend.map(v=><div key={v.date} className="flex min-w-0 flex-1 flex-col items-center gap-2"><div className="flex h-48 w-full items-end"><div title={faNum(v.messages)+" پیام"} className="mx-auto w-full max-w-9 rounded-t-xl bg-gradient-to-t from-primary/35 to-primary transition-all" style={{height:(Math.max(8,(v.messages/maxMessages)*100))+"%"}}/></div><span className="text-[9px] text-muted-foreground">{v.date.slice(5)}</span></div>)}</div></CardContent></Card>

      <Card className="cortex-panel rounded-2xl"><CardHeader><CardTitle className="text-base">کانال‌های فعال</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-white/[.06] bg-white/[.02] p-4"><div className="flex items-center gap-3"><Users className="size-4 text-primary"/><span className="text-sm">کاربران تلگرام</span></div><span className="text-lg font-bold">{faNum(data.users)}</span></div>
        <div className="flex items-center justify-between rounded-xl border border-white/[.06] bg-white/[.02] p-4"><div className="flex items-center gap-3"><Send className="size-4 text-secondary"/><span className="text-sm">ربات‌های تلگرام</span></div><span className="text-lg font-bold">{faNum(data.bots)}</span></div>
        <div className="flex items-center justify-between rounded-xl border border-white/[.06] bg-white/[.02] p-4"><div className="flex items-center gap-3"><MessageSquare className="size-4 text-emerald-400"/><span className="text-sm">پرسش‌های پرتکرار</span></div><span className="text-lg font-bold">{faNum(totalQuestions)}</span></div>
      </CardContent></Card>
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <Card className="cortex-panel rounded-2xl"><CardHeader><CardTitle className="text-base">پرسش‌های پرتکرار</CardTitle></CardHeader><CardContent>{data.topQuestions.length===0?<p className="py-10 text-center text-sm text-muted-foreground">هنوز داده‌ای ثبت نشده است.</p>:<div className="space-y-2">{data.topQuestions.map((q,i)=><div key={q.question} className="flex items-start gap-3 rounded-xl border border-white/[.06] p-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">{faNum(i+1)}</span><div className="min-w-0 flex-1"><p className="text-sm leading-6">{q.question}</p><p className="mt-1 text-[11px] text-muted-foreground">{faNum(q.count)} بار</p></div></div>)}</div>}</CardContent></Card>
      <Card className="cortex-panel rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="size-4 text-violet-300"/>جاهایی که دانش کم می‌آورد</CardTitle></CardHeader><CardContent>{data.unansweredQuestions.length===0?<p className="py-10 text-center text-sm text-muted-foreground">فعلاً موردی ثبت نشده است.</p>:<div className="space-y-2">{data.unansweredQuestions.map((q)=> <div key={q.question} className="rounded-xl border border-amber-400/10 bg-amber-400/[.025] p-3"><p className="text-sm leading-6">{q.question}</p><p className="mt-1 text-[11px] text-amber-300/80">{faNum(q.count)} بار بدون پوشش کافی</p></div>)}</div>}</CardContent></Card>
    </section>

    <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Sparkles className="size-3.5 text-primary"/>{data.note}</div>
  </div>;
}
