"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Activity, ArrowUpLeft, CheckCircle2, CircleDollarSign, Clock3, CreditCard, FileText,
  Info, Layers3, Plus, ShieldCheck, WalletCards, Sparkles,
} from "lucide-react";
import { api } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { faNum } from "@/components/cortex/format";
import { BillingEstimator } from "@/components/cortex/billing-estimator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status:string }){
  const config=status==="approved"
    ? {label:"تأیید شده",cls:"border-emerald-400/25 bg-emerald-400/10 text-emerald-300",icon:CheckCircle2}
    : status==="rejected"
      ? {label:"رد شده",cls:"border-rose-400/25 bg-rose-400/10 text-rose-300",icon:Info}
      : {label:"در انتظار بررسی",cls:"border-amber-400/25 bg-amber-400/10 text-amber-300",icon:Clock3};
  const Icon=config.icon;
  return <Badge variant="outline" className={cn("gap-1.5",config.cls)}><Icon className="size-3.5"/>{config.label}</Badge>;
}

export function BillingView(){
  const workspaceId=useCortexStore(s=>s.activeWorkspaceId);
  const qc=useQueryClient();
  const {data,isPending,isError,error}=useQuery({
    queryKey:["billing",workspaceId],
    queryFn:()=>api.getBilling(workspaceId??undefined),
    enabled:!!workspaceId,
    staleTime:20_000,
  });
  const topUp=useMutation({
    mutationFn:(packageKey:string)=>api.requestBillingTopUp(packageKey,workspaceId??undefined),
    onSuccess:()=>{toast.success("درخواست شارژ ثبت شد.");qc.invalidateQueries({queryKey:["billing",workspaceId]});},
    onError:(e:Error)=>toast.error(e.message),
  });

  const enabledModels=useMemo(()=>data?.models.filter(m=>m.enabledForPlan)??[],[data]);
  if(!workspaceId) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">فضای کاری فعالی انتخاب نشده است.</CardContent></Card>;
  if(isPending) return <div className="space-y-4"><div className="h-56 animate-pulse rounded-[28px] bg-muted"/><div className="grid gap-3 md:grid-cols-3">{[1,2,3].map(i=><div key={i} className="h-28 rounded-2xl bg-muted"/>)}</div></div>;
  if(isError||!data) return <Card><CardContent className="p-8"><p className="font-semibold">اعتبار در دسترس نیست.</p><p className="mt-2 text-sm text-muted-foreground">{error instanceof Error?error.message:"خطا در دریافت اطلاعات مالی."}</p></CardContent></Card>;

  const plan=data.account.plan;
  const balancePct=plan.monthlyCredits?Math.min(100,Math.round((Math.max(0,data.account.balanceCredits)/plan.monthlyCredits)*100)):0;
  const pending=data.topUpRequests.filter(x=>x.status==="pending").length;

  return <div className="space-y-5">
    <section className="cortex-wallet-card rounded-[28px] p-5 sm:p-7">
      <div className="grid items-center gap-5 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="flex flex-wrap items-center gap-2"><span className="cortex-kicker">CORTEX WALLET</span><Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">{plan.name}</Badge></div>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">اعتبار، مصرف و شارژ</h1>
          <p className="mt-2 max-w-xl text-xs leading-6 text-muted-foreground">موجودی، مصرف واقعی، درخواست شارژ و صورتحساب همین فضای کاری را یکجا ببین.</p>
          <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4">
            <div><p className="text-[10px] text-muted-foreground">موجودی فعلی</p><p className="mt-1 text-4xl font-black">{faNum(data.account.balanceCredits)}</p><p className="mt-1 text-[10px] text-muted-foreground">اعتبار</p></div>
            <div><p className="text-[10px] text-muted-foreground">مصرف ۳۰ روز</p><p className="mt-1 text-2xl font-bold">{faNum(data.usage30Days.credits)}</p><p className="mt-1 text-[10px] text-muted-foreground">اعتبار مصرف‌شده</p></div>
          </div>
          <div className="mt-5 max-w-xl"><div className="flex justify-between text-[10px] text-muted-foreground"><span>نسبت موجودی به اعتبار ماهانه</span><span>{faNum(balancePct)}٪</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-400" style={{width:balancePct+"%"}}/></div></div>
        </div>
        <div className="hidden place-items-center lg:grid"><div className="cortex-wallet-orb relative grid place-items-center"><div className="grid size-14 place-items-center rounded-2xl bg-black/20 text-white"><WalletCards className="size-6"/></div></div></div>
      </div>
    </section>

    <div className="grid gap-3 md:grid-cols-3">
      <Card className="cortex-panel rounded-2xl"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">پلن</span><CreditCard className="size-4 text-primary"/></div><p className="mt-3 text-lg font-bold">{plan.name}</p><p className="mt-1 text-xs text-muted-foreground">{plan.monthlyCredits?faNum(plan.monthlyCredits)+" اعتبار ماهانه":"اعتبار سفارشی"}</p></CardContent></Card>
      <Card className="cortex-panel rounded-2xl"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">مصرف توکن</span><Activity className="size-4 text-primary"/></div><p className="mt-3 text-lg font-bold">{faNum(data.usage30Days.tokens)}</p><p className="mt-1 text-xs text-muted-foreground">۳۰ روز اخیر</p></CardContent></Card>
      <Card className="cortex-panel rounded-2xl"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">پایان چرخه</span><CircleDollarSign className="size-4 text-primary"/></div><p className="mt-3 text-lg font-bold">{new Date(data.account.periodEnd).toLocaleDateString("fa-IR")}</p><p className="mt-1 text-xs text-muted-foreground">{data.account.enforcementEnabled?"کنترل اعتبار فعال":"حالت آزمایشی"}</p></CardContent></Card>
    </div>

    <BillingEstimator models={data.models} monthlyCredits={plan.monthlyCredits} overageCreditPriceToman={plan.overageCreditPriceToman}/>

    <section className="cortex-model-guide rounded-[24px] border border-border/60 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="cortex-kicker">MODEL GUIDE</p><h2 className="mt-2 text-xl font-black">هر مدل برای چه کاری ساخته شده؟</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">توضیحات محصول برای انتخاب سریع از کاتالوگ Cortex است؛ مستندات رسمی مدل مبنای نهایی قابلیت‌ها و قیمت هستند.</p></div>
        <span className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-[10px] text-primary">{faNum(enabledModels.length)} مدل فعال</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {enabledModels.slice(0,8).map((model)=>{
          const p=model.provider.toLowerCase();
          const family=p.includes("deepseek")?"DeepSeek":p.includes("anthropic")?"Claude":p.includes("google")?"Gemini":p.includes("openai")?"OpenAI":model.provider;
          const role=p.includes("deepseek")?"اقتصادی برای استدلال، کدنویسی و حجم بالا":p.includes("anthropic")?"مناسب متن عمیق، تحلیل و پاسخ‌های طولانی":p.includes("google")?"مناسب سرعت بالا و سناریوهای چندرسانه‌ای":p.includes("openai")?"مناسب اتوماسیون، ابزار و گردش‌کارهای پیچیده":"مدل عمومی برای سناریوی تعریف‌شده";
          const tradeoff=model.speedTier==="fast"?"تمرکز روی سرعت":model.qualityTier==="deep"?"مصرف بالاتر برای کارهای سنگین":"تعادل سرعت و کیفیت";
          return <motion.div key={model.id} whileHover={{y:-2}} className="group rounded-2xl border border-border/60 bg-background/35 p-4 transition-shadow hover:shadow-[0_15px_40px_rgba(0,0,0,.08)]">
            <div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-4"/></span><span className="rounded-full border border-border/60 px-2 py-1 text-[9px] text-muted-foreground">{model.speedTier}</span></div>
            <p className="mt-4 text-sm font-black">{family} · {model.displayName}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{model.provider}</p>
            <p className="mt-3 text-xs leading-6 text-foreground/90">{role}</p>
            <p className="mt-3 text-[10px] leading-5 text-muted-foreground">نکته انتخاب: {tradeoff}</p>
            <div className="mt-4 border-t border-border/50 pt-3 text-[9px] text-muted-foreground"><span>{"$"}{model.inputUsdPer1M}/M in</span><span className="mx-2">·</span><span>{"$"}{model.outputUsdPer1M}/M out</span></div>
          </motion.div>;
        })}
      </div>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[.06] bg-white/[.012] px-3 py-2 text-[10px] text-muted-foreground"><span>قیمت‌های مرجع مدل‌ها: {new Date(data.pricing.verifiedAt+"T00:00:00Z").toLocaleDateString("fa-IR")} · {data.pricing.mode==="official-provider-snapshot"?"snapshot رسمی تأمین‌کننده":"نرخ سفارشی"}</span><span>هزینه واقعی پس از اجرا از توکن مصرف‌شده ثبت می‌شود.</span></div>

    <section className="cortex-panel rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="cortex-kicker">TOP UP</p><h2 className="mt-2 text-xl font-bold">شارژ سریع</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">یک درخواست ثبت می‌کنی؛ بعد از تأیید مدیریت، اعتبار وارد موجودی می‌شود.</p></div>
        <div className="flex items-center gap-2 text-[10px] text-primary"><ShieldCheck className="size-3.5"/>ثبت در Ledger</div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {data.topUpPackages.map((item,index)=><button key={item.key} type="button" disabled={topUp.isPending} onClick={()=>topUp.mutate(item.key)} className="cortex-wallet-package rounded-2xl border border-white/[.07] bg-white/[.018] p-4 text-right disabled:opacity-60">
          <div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">{index===0?<Plus className="size-4"/>:index===1?<Layers3 className="size-4"/>:<WalletCards className="size-4"/>}</span><ArrowUpLeft className="size-4 text-muted-foreground"/></div>
          <p className="mt-3 text-sm font-bold">{item.label}</p>
          <p className="mt-1 text-xl font-black">{faNum(item.credits)}</p><p className="text-[10px] text-muted-foreground">اعتبار · {faNum(item.amountToman)} تومان</p>
        </button>)}
      </div>
      {pending>0&&<div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-[11px] text-amber-200"><Clock3 className="me-1 inline size-3.5"/>{faNum(pending)} درخواست در انتظار بررسی.</div>}
    </section>

    <details className="cortex-panel group rounded-2xl p-5">
      <summary className="cursor-pointer list-none text-sm font-bold">سوابق مالی و صورتحساب <span className="float-left text-xs text-muted-foreground group-open:rotate-180">⌄</span></summary>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div><div className="mb-3 flex items-center gap-2"><CreditCard className="size-4 text-primary"/><h3 className="text-sm font-bold">درخواست‌های شارژ</h3></div>
          {data.topUpRequests.length===0?<p className="rounded-xl border border-white/[.06] p-4 text-xs text-muted-foreground">هنوز درخواستی ثبت نشده.</p>:<div className="space-y-2">{data.topUpRequests.map(x=><div key={x.id} className="flex items-center gap-3 rounded-xl border border-white/[.06] p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{faNum(x.credits)} اعتبار · {faNum(x.amountToman)} تومان</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(x.createdAt).toLocaleString("fa-IR")}</p></div><StatusBadge status={x.status}/></div>)}</div>}
        </div>
        <div><div className="mb-3 flex items-center gap-2"><FileText className="size-4 text-primary"/><h3 className="text-sm font-bold">صورتحساب‌ها</h3></div>
          {data.invoices.length===0?<p className="rounded-xl border border-white/[.06] p-4 text-xs text-muted-foreground">هنوز صورتحسابی ثبت نشده.</p>:<div className="space-y-2">{data.invoices.map(x=><div key={x.id} className="flex items-center gap-3 rounded-xl border border-white/[.06] p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{x.invoiceNumber}</p><p className="mt-1 text-[10px] text-muted-foreground">{faNum(x.totalToman)} تومان · {new Date(x.periodEnd).toLocaleDateString("fa-IR")}</p></div><Badge variant="outline">{x.status}</Badge></div>)}</div>}
        </div>
      </div>
    </details>

    <details className="cortex-panel rounded-2xl p-5">
      <summary className="cursor-pointer list-none text-sm font-bold">پلن‌ها و مدل‌های قابل استفاده</summary>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="space-y-2">{data.plans.map(item=><div key={item.id} className={cn("rounded-xl border p-3",item.key===plan.key?"border-primary/30 bg-primary/5":"border-white/[.06]")}><div className="flex justify-between gap-3"><span className="text-xs font-semibold">{item.name}</span><span className="text-[10px] text-muted-foreground">{item.priceToman?faNum(item.priceToman)+" تومان":"سفارشی/رایگان"}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{item.monthlyCredits?faNum(item.monthlyCredits)+" اعتبار ماهانه":"اعتبار سفارشی"}</p></div>)}</div>
        <div className="space-y-2">{enabledModels.slice(0,12).map(item=><div key={item.id} className="flex items-center justify-between rounded-xl border border-white/[.06] p-3"><div><p className="text-xs font-semibold">{item.displayName}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.provider} · \${item.inputUsdPer1M}/M in · \${item.outputUsdPer1M}/M out</p></div><span className="text-[10px] text-primary">{item.qualityTier}</span></div>)}{enabledModels.length===0&&<p className="text-xs text-muted-foreground">مدل فعالی برای این پلن ثبت نشده است.</p>}</div>
      </div>
    </details>
  </div>;
}
