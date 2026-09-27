 "use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, CreditCard, Info, Sparkles } from "lucide-react";
import { api } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { faNum } from "@/components/cortex/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function BillingView() {
  const workspaceId = useCortexStore((s)=>s.activeWorkspaceId);
  const { data, isPending, isError, error } = useQuery({
    queryKey:["billing",workspaceId],
    queryFn:()=>api.getBilling(workspaceId ?? undefined),
    enabled:!!workspaceId,
    staleTime:30_000,
  });

  const byProvider = useMemo(()=>{
    if(!data) return [] as Array<[string,number]>;
    const map = new Map<string,number>();
    for(const model of data.models) map.set(model.provider,(map.get(model.provider)??0)+1);
    return [...map.entries()];
  },[data]);

  if(!workspaceId) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">فضای کاری فعالی انتخاب نشده است.</CardContent></Card>;
  if(isPending) return <div className="space-y-5"><div className="h-36 animate-pulse rounded-[28px] bg-muted"/><div className="grid gap-4 md:grid-cols-3">{Array.from({length:3}).map((_,i)=><div key={i} className="h-32 animate-pulse rounded-2xl bg-muted"/>)}</div></div>;
  if(isError || !data) return <Card className="border-destructive/30"><CardContent className="p-7"><p className="font-semibold">صورتحساب در دسترس نیست.</p><p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : "خطا در دریافت اطلاعات تجاری"}</p></CardContent></Card>;

  const plan = data.account.plan;
  const shadow = !data.account.enforcementEnabled;

  return <div className="space-y-7">
    <section className="cortex-panel relative overflow-hidden rounded-[28px] p-6 sm:p-8">
      <div className="absolute -end-16 -top-24 size-64 rounded-full bg-primary/10 blur-3xl"/>
      <div className="relative">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="cortex-kicker">CORTEX BILLING</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">اعتبار و پلن کسب‌وکار</h2><p className="mt-3 max-w-2xl text-sm leading-8 text-muted-foreground">Cortex هزینه واقعی مدل‌ها را ثبت می‌کند و مصرف تجاری را به «اعتبار Cortex» تبدیل می‌کند.</p></div>
          <Badge variant="outline" className="w-fit gap-2 border-primary/25 bg-primary/10 text-primary"><CreditCard className="size-3.5"/>{plan.name}</Badge>
        </div>
      </div>
    </section>

    {shadow && <div className="flex items-start gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/[.04] p-4 text-xs leading-6 text-amber-200"><Info className="mt-0.5 size-4 shrink-0"/><span>حساب مالی فعلاً در حالت حسابداری/آزمایشی است؛ مصرف و هزینه ثبت می‌شوند، اما کسر اعتبار و مسدودسازی تا زمان فعال‌سازی تجاری این workspace انجام نمی‌شود.</span></div>}

    <section className="grid gap-3 md:grid-cols-3">
      <Card className="cortex-panel rounded-2xl"><CardContent className="p-5"><div className="flex items-center justify-between"><span className="cortex-icon-box"><Sparkles className="size-[18px]"/></span><span className="text-[10px] text-muted-foreground">اعتبار</span></div><p className="mt-5 text-3xl font-bold">{faNum(data.account.balanceCredits)}</p><p className="mt-1 text-xs text-muted-foreground">اعتبار فعلی</p></CardContent></Card>
      <Card className="cortex-panel rounded-2xl"><CardContent className="p-5"><div className="flex items-center justify-between"><span className="cortex-icon-box"><CircleDollarSign className="size-[18px]"/></span><span className="text-[10px] text-muted-foreground">۳۰ روز اخیر</span></div><p className="mt-5 text-2xl font-bold">${usageCostUsd.toFixed(4)}</p><p className="mt-1 text-xs text-muted-foreground">{faNum(data.usage30Days.tokens)} توکن · {faNum(data.usage30Days.events)} رخداد</p></CardContent></Card>
      <Card className="cortex-panel rounded-2xl"><CardContent className="p-5"><div className="flex items-center justify-between"><span className="cortex-icon-box"><CreditCard className="size-[18px]"/></span><span className="text-[10px] text-muted-foreground">چرخه</span></div><p className="mt-5 text-base font-bold">{new Date(data.account.periodEnd).toLocaleDateString("fa-IR")}</p><p className="mt-1 text-xs text-muted-foreground">پایان دوره فعلی</p></CardContent></Card>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Card className="cortex-panel rounded-2xl"><CardHeader><CardTitle className="text-base">پلن‌های آماده</CardTitle><CardDescription>قیمت و سقف اعتبار از کاتالوگ تجاری Cortex خوانده می‌شود.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{data.plans.map((item)=><div key={item.id} className={item.key===plan.key ? "rounded-2xl border border-primary/35 bg-primary/[.05] p-4" : "rounded-2xl border border-white/[.06] p-4"}><div className="flex items-center justify-between gap-3"><p className="font-semibold">{item.name}</p>{item.key===plan.key&&<Badge variant="outline" className="text-[10px]">فعال</Badge>}</div><p className="mt-2 text-xl font-bold">{item.priceToman?faNum(item.priceToman)+" تومان":"رایگان / سفارشی"}</p><p className="mt-1 text-xs text-muted-foreground">{item.monthlyCredits?faNum(item.monthlyCredits)+" اعتبار ماهانه":"اعتبار سفارشی"}</p>{item.description&&<p className="mt-2 text-[11px] leading-5 text-muted-foreground">{item.description}</p>}</div>)}</CardContent></Card>
      <Card className="cortex-panel rounded-2xl"><CardHeader><CardTitle className="text-base">مدل‌های تجاری</CardTitle><CardDescription>رجیستری مدل‌ها از نرخ‌های مرکزی Cortex تغذیه می‌شود.</CardDescription></CardHeader><CardContent className="space-y-3">{byProvider.map(([provider,count])=><div key={provider} className="flex items-center justify-between rounded-xl border border-white/[.06] p-3"><span className="text-sm">{provider}</span><span className="text-xs text-muted-foreground">{faNum(count)} مدل</span></div>)}<p className="pt-2 text-[11px] leading-5 text-muted-foreground">ضریب مصرف مدل بر اساس سطح مدل تعیین می‌شود؛ مدل‌های اقتصادی، متعادل، پیشرفته و تحلیلی ضرایب متفاوت دارند.</p></CardContent></Card>
    </section>

    <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">آخرین تغییرات اعتبار</CardTitle></CardHeader><CardContent className="space-y-2">{data.ledger.length===0?<p className="py-8 text-center text-sm text-muted-foreground">هنوز رکورد مالی ثبت نشده است.</p>:data.ledger.slice(0,8).map(x=><div key={x.id} className="flex items-center gap-3 rounded-xl border border-white/[.06] p-3"><span className={x.amountCredits>=0?"text-emerald-300":"text-amber-300"}>{x.amountCredits>=0?"+":""}{faNum(x.amountCredits)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm">{x.description||x.entryType}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(x.createdAt).toLocaleString("fa-IR")}</p></div><span className="text-[11px] text-muted-foreground">{faNum(x.balanceAfter)}</span></div>)}</CardContent></Card>
  </div>;
}
