"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Activity, ArrowUpLeft, BarChart3, CheckCircle2, ChevronDown, CircleDollarSign, Clock3, CreditCard, FileText, Gauge,
  Info, Layers3, Plus, ShieldCheck, WalletCards, Sparkles,
} from "lucide-react";
import { api } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { faNum, formatTomanCompact, formatCountCompact } from "@/components/cortex/format";
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
    mutationFn:(packageKey:string)=>api.startBillingTopUpPayment(packageKey,workspaceId??undefined),
    onSuccess:(result)=>{window.location.assign(result.redirectUrl);},
    onError:(e:Error)=>toast.error(e.message),
  });
  const [selectedPlanKey, setSelectedPlanKey] = useState<string | null>(null);
  const planPurchase=useMutation({
    mutationFn:(planKey:string)=>api.startBillingPlanPayment(planKey,workspaceId??undefined),
    onSuccess:(result)=>{setSelectedPlanKey(null);window.location.assign(result.redirectUrl);},
    onError:(e:Error)=>{setSelectedPlanKey(null);toast.error(e.message);},
  });

  const enabledModels=useMemo(()=>data?.models.filter(m=>m.enabledForPlan)??[],[data]);
  if(!workspaceId) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">فضای کاری فعالی انتخاب نشده است.</CardContent></Card>;
  if(isPending) return <div className="space-y-4"><div className="h-56 animate-pulse rounded-[28px] bg-muted"/><div className="grid gap-3 md:grid-cols-3">{[1,2,3].map(i=><div key={i} className="h-28 rounded-2xl bg-muted"/>)}</div></div>;
  if(isError||!data) return <Card><CardContent className="p-8"><p className="font-semibold">اعتبار در دسترس نیست.</p><p className="mt-2 text-sm text-muted-foreground">{error instanceof Error?error.message:"خطا در دریافت اطلاعات مالی."}</p></CardContent></Card>;

  const plan=data.account.plan;
  const balancePct=plan.monthlyCredits?Math.min(100,Math.round((Math.max(0,data.account.balanceCredits)/plan.monthlyCredits)*100)):0;
  const pending=data.topUpRequests.filter(x=>x.status==="pending").length;
  const needsPlan = plan.monthlyCredits > 0 && data.account.balanceCredits <= 0;
  const lowBalance = !needsPlan && plan.monthlyCredits > 0 && balancePct <= 20;

  const modelUsage = data.usage30Days.byModel ?? [];
  const maxModelTokens = Math.max(...modelUsage.map((usageItem) => usageItem.tokens), 1);

  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <div className="space-y-4 sm:space-y-5">
    {(needsPlan || lowBalance) && <section className={cn("rounded-2xl border p-4 sm:p-5", needsPlan ? "border-primary/25 bg-primary/[.055]" : "border-amber-400/25 bg-amber-400/[.045]")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black">{needsPlan ? "برای شروع، یک پلن انتخاب کن." : "اعتبارت رو به اتمام است."}</p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{needsPlan ? "پلن را انتخاب کن تا مدل‌های managed و اجرای Agentها فعال شوند." : "برای ادامه بدون وقفه، همین حالا یک بسته اعتبار تهیه کن."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={()=>jumpTo("cortex-plans")} className="h-10 rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground">{needsPlan ? "انتخاب پلن" : "مشاهده پلن‌ها"}</button>
          {!needsPlan && <button type="button" onClick={()=>jumpTo("cortex-topup")} className="h-10 rounded-xl border border-border/70 px-4 text-xs font-bold">شارژ سریع</button>}
        </div>
      </div>
    </section>}

    <motion.section
      initial={{ opacity: 0, y: 10, scale: .99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: .28, ease: "easeOut" }}
      className="cortex-wallet-quick relative overflow-hidden rounded-[22px] border border-primary/15 bg-primary/[.035] p-3.5 sm:p-4"
    >
      <span aria-hidden="true" className="cortex-wallet-quick-glow absolute -end-12 -top-16 size-44 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="cortex-kicker">QUICK ACCESS</span>
              <span className="rounded-full border border-primary/15 bg-primary/5 px-2 py-1 text-[8px] font-bold text-primary">{plan.name}</span>
              <span className="rounded-full border border-border/60 bg-background/35 px-2 py-1 text-[8px] text-muted-foreground">Wallet</span>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-1">
              <p className="text-xl font-black">{formatCountCompact(data.account.balanceCredits)} <span className="text-[10px] font-semibold text-muted-foreground">اعتبار</span></p>
              <p className="text-[10px] text-muted-foreground">۳۰ روز: {formatCountCompact(data.usage30Days.tokens)} توکن · {formatCountCompact(data.usage30Days.credits)} اعتبار</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[430px]">
            <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2"><p className="text-[8px] text-muted-foreground">اعتبار باقی‌مانده</p><p className="mt-1 text-xs font-black">{formatCountCompact(data.account.balanceCredits)}</p></div>
            <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2"><p className="text-[8px] text-muted-foreground">پلن فعلی</p><p className="mt-1 truncate text-xs font-black">{plan.name}</p></div>
            <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2"><p className="text-[8px] text-muted-foreground">توکن ۳۰ روز</p><p className="mt-1 text-xs font-black">{formatCountCompact(data.usage30Days.tokens)}</p></div>
            <div className="rounded-xl border border-primary/10 bg-primary/[.045] px-3 py-2"><p className="text-[8px] text-muted-foreground">مصرف پلن</p><p className="mt-1 text-xs font-black">{faNum(balancePct)}٪</p></div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => jumpTo("cortex-topup")} className="cortex-wallet-quick-btn"><Plus className="size-3.5"/>شارژ سریع</button>
          <button type="button" onClick={() => jumpTo("cortex-cost-lab")} className="cortex-wallet-quick-btn"><Gauge className="size-3.5"/>Cost Lab</button>
          <button type="button" onClick={() => jumpTo("cortex-usage-analytics")} className="cortex-wallet-quick-btn"><BarChart3 className="size-3.5"/>تحلیل مصرف</button>
        </div>
      </div>
    </motion.section>

    <section className="cortex-wallet-card rounded-[28px] p-5 sm:p-7">
      <div className="grid items-center gap-5 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="flex flex-wrap items-center gap-2"><span className="cortex-kicker">CORTEX WALLET</span><Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">{plan.name}</Badge></div>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">اعتبار، مصرف و شارژ</h1>
          <p className="mt-2 max-w-xl text-xs leading-6 text-muted-foreground">موجودی، مصرف واقعی، درخواست شارژ و صورتحساب همین فضای کاری را یکجا ببین.</p>
          <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4">
            <div><p className="text-[10px] text-muted-foreground">موجودی فعلی</p><p className="mt-1 text-4xl font-black">{formatCountCompact(data.account.balanceCredits)}</p><p className="mt-1 text-[10px] text-muted-foreground">اعتبار</p></div>
            <div><p className="text-[10px] text-muted-foreground">مصرف ۳۰ روز</p><p className="mt-1 text-2xl font-bold">{formatCountCompact(data.usage30Days.credits)}</p><p className="mt-1 text-[10px] text-muted-foreground">اعتبار مصرف‌شده</p></div>
          </div>
          <div className="mt-5 max-w-xl"><div className="flex justify-between text-[10px] text-muted-foreground"><span>نسبت موجودی به اعتبار ماهانه</span><span>{faNum(balancePct)}٪</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-400" style={{width:balancePct+"%"}}/></div></div>
        </div>
        <div className="hidden place-items-center lg:grid"><div className="cortex-wallet-orb relative grid place-items-center"><div className="grid size-14 place-items-center rounded-2xl bg-black/20 text-white"><WalletCards className="size-6"/></div></div></div>
      </div>
    </section>

    <div className="grid gap-3 md:grid-cols-3">
      <Card className="cortex-panel rounded-2xl"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">پلن</span><CreditCard className="size-4 text-primary"/></div><p className="mt-3 text-lg font-bold">{plan.name}</p><p className="mt-1 text-xs text-muted-foreground">{plan.monthlyCredits?formatCountCompact(plan.monthlyCredits)+" اعتبار ماهانه":"اعتبار سفارشی"}</p></CardContent></Card>
      <Card className="cortex-panel rounded-2xl"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">مصرف توکن</span><Activity className="size-4 text-primary"/></div><p className="mt-3 text-lg font-bold">{formatCountCompact(data.usage30Days.tokens)}</p><p className="mt-1 text-xs text-muted-foreground">۳۰ روز اخیر</p></CardContent></Card>
      <Card className="cortex-panel rounded-2xl"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">پایان چرخه</span><CircleDollarSign className="size-4 text-primary"/></div><p className="mt-3 text-lg font-bold">{new Date(data.account.periodEnd).toLocaleDateString("fa-IR")}</p><p className="mt-1 text-xs text-muted-foreground">{data.account.enforcementEnabled?"کنترل اعتبار فعال":"حالت آزمایشی"}</p></CardContent></Card>
    </div>

    <details id="cortex-cost-lab" className="cortex-panel rounded-2xl overflow-hidden"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-bold"><span className="flex items-center gap-2"><Gauge className="size-4 text-primary"/>تخمین مصرف، توکن و هزینه</span><ChevronDown className="size-4"/></summary><div className="border-t border-border/60 p-3 sm:p-4"><BillingEstimator models={data.models} monthlyCredits={plan.monthlyCredits} overageCreditPriceToman={plan.overageCreditPriceToman} plans={data.plans} pricingVerifiedAt={data.pricingVerifiedAt}/></div></details>


    {!needsPlan && (
    <section id="cortex-topup" className="cortex-panel rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="cortex-kicker">TOP UP</p><h2 className="mt-2 text-xl font-bold">شارژ سریع</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">درگاه آنلاین را باز کن، پرداخت را انجام بده و بعد از تأیید تراکنش، اعتبار به‌صورت خودکار وارد Wallet می‌شود.</p></div>
        <div className="flex items-center gap-2 text-[10px] text-primary"><ShieldCheck className="size-3.5"/>ثبت در Ledger</div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {data.topUpPackages.map((item,index)=><button key={item.key} type="button" disabled={topUp.isPending} onClick={()=>topUp.mutate(item.key)} className="cortex-wallet-package group rounded-2xl border border-white/[.07] bg-white/[.018] p-4 text-right disabled:opacity-60">
          <div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">{index===0?<Plus className="size-4"/>:index===1?<Layers3 className="size-4"/>:<WalletCards className="size-4"/>}</span><ArrowUpLeft className="size-4 text-muted-foreground"/></div>
          <p className="mt-3 text-sm font-bold">{item.label}</p>
          <p className="mt-1 text-xl font-black">{formatCountCompact(item.credits)}</p><p className="text-[10px] text-muted-foreground">اعتبار · {formatTomanCompact(item.amountToman)}</p>
          <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-2 py-1 text-[9px] font-semibold text-primary transition group-hover:bg-primary/10"><CreditCard className="size-3"/>پرداخت و شارژ</span>
        </button>)}
      </div>
      {pending>0&&<div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-[11px] text-amber-200"><Clock3 className="me-1 inline size-3.5"/>{faNum(pending)} درخواست در انتظار بررسی.</div>}
    </section>
    )}

    <details id="cortex-usage-analytics" className="cortex-panel group rounded-2xl overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-bold"><span className="flex items-center gap-2"><BarChart3 className="size-4 text-primary"/>آنالیز مصرف مدل‌ها و توکن‌ها</span><span className="flex items-center gap-2 text-[9px] font-normal text-muted-foreground">{formatCountCompact(modelUsage.length)} مدل · ۳۰ روز اخیر <ChevronDown className="size-4 transition-transform [details[open]_&]:rotate-180"/></span></summary>
      <div className="border-t border-border/60 p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-[9px] text-muted-foreground">کل توکن</p><p className="mt-1 text-lg font-black">{formatCountCompact(data.usage30Days.tokens)}</p><p className="mt-1 text-[9px] text-muted-foreground">{formatCountCompact(data.usage30Days.events)} رویداد</p></div>
          <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-[9px] text-muted-foreground">کل اعتبار مصرف‌شده</p><p className="mt-1 text-lg font-black">{formatCountCompact(data.usage30Days.credits)}</p><p className="mt-1 text-[9px] text-muted-foreground">از Wallet</p></div>
          <div className="rounded-2xl border border-primary/15 bg-primary/[.045] p-3"><p className="text-[9px] text-muted-foreground">مدل‌های درگیر</p><p className="mt-1 text-lg font-black">{formatCountCompact(modelUsage.length)}</p><p className="mt-1 text-[9px] text-muted-foreground">بر اساس رویدادهای واقعی</p></div>
        </div>
        <div className="mt-4 space-y-2">
          {modelUsage.length===0 ? <p className="rounded-xl border border-dashed border-border/60 p-5 text-center text-xs text-muted-foreground">هنوز مصرف مدل ثبت نشده است.</p> : modelUsage.map((usageItem) => (
            <div key={(usageItem.provider??"unknown")+"-"+(usageItem.model??"unknown")} className="rounded-2xl border border-border/50 bg-background/25 p-3">
              <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{usageItem.displayName}</p><p className="mt-1 truncate text-[9px] text-muted-foreground">مدل مدیریت‌شده Cortex</p></div><div className="text-end"><p className="text-xs font-black">{formatCountCompact(usageItem.credits)} اعتبار</p><p className="mt-1 text-[9px] text-muted-foreground">{formatCountCompact(usageItem.tokens)} توکن · {formatCountCompact(usageItem.events)} رویداد</p></div></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-400" style={{width:Math.max(3,Math.round((usageItem.tokens/maxModelTokens)*100))+"%"}}/></div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-muted-foreground"><span>ورودی: {formatCountCompact(usageItem.inputTokens)}</span><span>خروجی: {formatCountCompact(usageItem.outputTokens)}</span><span>هزینه تأمین: ${((usageItem.estimatedCostMicros ?? 0)/1_000_000).toFixed(4)}</span></div>
            </div>
          ))}
        </div>
      </div>
    </details>
    <details className="cortex-panel group rounded-2xl p-5">
      <summary className="cursor-pointer list-none text-sm font-bold">سوابق مالی و صورتحساب <span className="float-left text-xs text-muted-foreground group-open:rotate-180">⌄</span></summary>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div><div className="mb-3 flex items-center gap-2"><CreditCard className="size-4 text-primary"/><h3 className="text-sm font-bold">درخواست‌های شارژ</h3></div>
          {data.topUpRequests.length===0?<p className="rounded-xl border border-white/[.06] p-4 text-xs text-muted-foreground">هنوز درخواستی ثبت نشده.</p>:<div className="space-y-2">{data.topUpRequests.map(x=><div key={x.id} className="flex items-center gap-3 rounded-xl border border-white/[.06] p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{formatCountCompact(x.credits)} اعتبار · {formatTomanCompact(x.amountToman)}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(x.createdAt).toLocaleString("fa-IR")}</p></div><StatusBadge status={x.status}/></div>)}</div>}
        </div>
        <div><div className="mb-3 flex items-center gap-2"><FileText className="size-4 text-primary"/><h3 className="text-sm font-bold">صورتحساب‌ها</h3></div>
          {data.invoices.length===0?<p className="rounded-xl border border-white/[.06] p-4 text-xs text-muted-foreground">هنوز صورتحسابی ثبت نشده.</p>:<div className="space-y-2">{data.invoices.map(x=><div key={x.id} className="flex items-center gap-3 rounded-xl border border-white/[.06] p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{x.invoiceNumber}</p><p className="mt-1 text-[10px] text-muted-foreground">{formatTomanCompact(x.totalToman)} · {new Date(x.periodEnd).toLocaleDateString("fa-IR")}</p></div><Badge variant="outline">{x.status}</Badge></div>)}</div>}
        </div>
      </div>
    </details>

    <section id="cortex-plans" className="cortex-panel rounded-2xl p-4 sm:p-6 scroll-mt-20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="cortex-kicker">MONTHLY PLANS</p><h2 className="mt-2 text-xl font-black sm:text-2xl">پلن مناسب استفاده‌ات را انتخاب کن.</h2><p className="mt-1 max-w-2xl text-xs leading-6 text-muted-foreground">مدل و زیرساخت را Cortex مدیریت می‌کند؛ تفاوت پلن‌ها در اعتبار، سطح مدل‌ها و امکانات تیمی است.</p></div>
        <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[9px] font-bold text-primary">۴ سطح Cortex</span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {data.plans.filter(item=>["launch","growth","scale","enterprise"].includes(item.key)).map((item)=>{
          const isCurrent=item.key===plan.key;
          const featured=item.key==="growth";
          const details:Record<string,{headline:string;features:string[]}>={
            launch:{headline:"برای شروع سریع و کم‌ریسک",features:["تا ۲ Agent","دانش محدود و کنترل‌شده","مدل‌های اقتصادی و سریع","اتصال پایه Telegram"]},
            growth:{headline:"تعادل ایده‌آل برای تیم در حال رشد",features:["چندین Agent","پایگاه دانش گسترده‌تر","مدل‌های با کیفیت بالاتر","تحلیل دقیق مصرف و هزینه","اولویت پاسخ بالاتر"]},
            scale:{headline:"برای اتوماسیون جدی و مصرف سنگین",features:["Agentهای بیشتر","مدل‌های قوی‌تر","چند Bot","گزارش‌های پیشرفته","اولویت پاسخ‌گویی بالا"]},
            enterprise:{headline:"کنترل کامل برای سازمان",features:["تمام ظرفیت Cortex","مدل‌های اختصاصی","سفارشی‌سازی و SLA","پشتیبانی اختصاصی و قرارداد سازمانی"]},
          };
          const meta=details[item.key] ?? details.launch;
          return <motion.article
            key={item.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: .18 }}
            whileHover={{ y: -5 }}
            transition={{ duration: .28, ease: "easeOut" }}
            className={cn("relative flex min-h-[430px] h-full sm:min-h-[460px] lg:min-h-[500px] flex-col overflow-hidden rounded-2xl border p-4 sm:p-5 transition-shadow duration-300",
              featured ? "border-primary/45 bg-primary/[.075] shadow-[0_24px_70px_rgba(59,130,255,.16)]" : "border-border/65 bg-background/30",
              selectedPlanKey === item.key ? "ring-2 ring-primary/35 shadow-[0_25px_70px_rgba(59,130,255,.18)]" : ""
            )}>
            {featured&&<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-violet-400 to-primary"/>}
            <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black">{item.name}</h3>{featured&&<Badge className="bg-primary text-[8px]">پیشنهاد ویژه</Badge>}{isCurrent&&<Badge variant="outline" className="border-primary/20 bg-primary/5 text-[8px] text-primary">پلن فعلی</Badge>}</div><p className="mt-1 text-[10px] font-semibold text-primary/90">{meta.headline}</p></div><WalletCards className="size-5 text-primary"/></div>
            <p className="mt-4 text-2xl font-black">{item.priceToman?formatTomanCompact(item.priceToman):"از ۳۵٬۰۰۰٬۰۰۰"}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.priceToman?"تومان / ماه":"تومان / ماه · توافقی"}</p>
            <p className="mt-3 text-sm font-black">{item.monthlyCredits?formatCountCompact(item.monthlyCredits)+" اعتبار ماهانه":"اعتبار توافقی"}</p>
            <div className="my-4 h-px bg-border/60"/><div className="space-y-2">{meta.features.map((feature)=><div key={feature} className="flex items-start gap-2 text-[10px] leading-5 text-muted-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400"/>{feature}</div>)}</div>
            <div className="mt-auto min-h-14 pt-5">
              {isCurrent ? (
                <button type="button" disabled className="flex h-10 w-full items-center justify-center rounded-xl border border-border/70 text-xs font-bold text-muted-foreground">پلن فعلی</button>
              ) : item.key === "enterprise" ? (
                <motion.button type="button" whileHover={{ scale: 1.015 }} whileTap={{ scale: .98 }} onClick={() => toast.info("Enterprise به‌صورت قراردادی فعال می‌شود و شرایط SLA اختصاصی دارد.")} className="flex h-10 w-full items-center justify-center rounded-xl border border-border/70 text-xs font-bold transition-all hover:border-primary/30 hover:bg-primary/[.04]">درخواست Enterprise</motion.button>
              ) : (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: .975 }}
                  disabled={planPurchase.isPending}
                  onClick={() => { setSelectedPlanKey(item.key); planPurchase.mutate(item.key); }}
                  className={cn("relative flex h-11 w-full items-center justify-center overflow-hidden rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground shadow-[0_10px_30px_rgba(59,130,255,.18)] transition-all hover:shadow-[0_15px_40px_rgba(59,130,255,.28)] disabled:cursor-wait disabled:opacity-60")}
                >
                  <span className="absolute inset-0 -translate-x-full bg-white/15 transition-transform duration-700 hover:translate-x-full" />
                  <span className="relative">{planPurchase.isPending && selectedPlanKey === item.key ? "در حال انتقال به پرداخت…" : featured ? "قدرت بیشتری آزاد کن" : "انتخاب " + item.name}</span>
                </motion.button>
              )}
            </div>
            <p className="mt-2 min-h-4 text-center text-[9px] text-muted-foreground">{featured?"تعادل ایده‌آل بین قدرت و هزینه برای تیم‌های در حال رشد.":"\u00A0"}</p>
          </article>;
        })}
      </div>
    </section>

    <section id="cortex-models" className="cortex-panel rounded-2xl p-4 sm:p-6 scroll-mt-20">
      {plan.key === "free" ? (
        <div className="mb-4 rounded-2xl border border-primary/15 bg-primary/[.04] p-3 text-xs leading-6 text-muted-foreground">
          <span className="font-black text-foreground">پلن آزمایشی:</span>{" "}
          برای کنترل هزینه، فقط سه مدل اقتصادی منتخب Cortex در این سطح فعال هستند؛
          مدل‌های حرفه‌ای‌تر با ارتقا به پلن‌های بالاتر باز می‌شوند.
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="cortex-kicker">CORTEX MODEL CATALOG</p>
          <h2 className="mt-2 text-xl font-black">مدل‌ها بر اساس پلن باز می‌شوند.</h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            مدل‌ها با نام و قابلیت نمایش داده می‌شوند؛ اتصال و زیرساخت را Cortex مدیریت می‌کند.
          </p>
        </div>
        <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[9px] text-primary">
          {formatCountCompact(data.models.length)} مدل
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.models.map((model) => {
          const allowed = model.enabledForPlan;
          const tierLabel =
            model.qualityTier === "economy"
              ? "سریع و اقتصادی"
              : model.qualityTier === "balanced"
                ? "حرفه‌ای"
                : model.qualityTier === "premium"
                  ? "متخصص"
                  : "پیشرفته";

          return (
            <article
              key={model.id}
              className={cn(
                "rounded-2xl border p-4",
                allowed
                  ? "border-border/70 bg-background/30"
                  : "border-border/45 bg-background/15 opacity-65",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{model.displayName}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{tierLabel}</p>
                </div>
                <Badge variant={allowed ? "default" : "outline"}>
                  {allowed ? "مجاز" : "قفل"}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {model.reasoning ? (
                  <span className="rounded-full border border-border/60 px-2 py-1 text-[8px]">
                    استدلال
                  </span>
                ) : null}
                {model.tools ? (
                  <span className="rounded-full border border-border/60 px-2 py-1 text-[8px]">
                    ابزار
                  </span>
                ) : null}
                {model.vision ? (
                  <span className="rounded-full border border-border/60 px-2 py-1 text-[8px]">
                    Vision
                  </span>
                ) : null}
              </div>

              <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
                {allowed
                  ? "در پلن فعلی قابل استفاده است."
                  : "با ارتقا به پلن بالاتر باز می‌شود."}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  </div>;
}
