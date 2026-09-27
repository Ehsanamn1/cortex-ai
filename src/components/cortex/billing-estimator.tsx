"use client";

import { useMemo, useState } from "react";
import { Calculator, Coins, Gauge, Sigma } from "lucide-react";
import { faNum } from "@/components/cortex/format";

type EstimatorModel = {
  id:string;
  provider:string;
  modelId:string;
  displayName:string;
  inputUsdPer1M:number;
  outputUsdPer1M:number;
  qualityTier:string;
  speedTier:string;
  creditMultiplierBps:number;
  enabledForPlan:boolean;
};

type Props = {
  models: EstimatorModel[];
  monthlyCredits:number;
  overageCreditPriceToman:number;
};

export function BillingEstimator({models,monthlyCredits,overageCreditPriceToman}:Props){
  const available=models.filter(m=>m.enabledForPlan);
  const [modelId,setModelId]=useState(available[0]?.id ?? models[0]?.id ?? "");
  const [input,setInput]=useState(4000);
  const [output,setOutput]=useState(1200);
  const selected=useMemo(()=>models.find(m=>m.id===modelId)??models[0], [modelId,models]);

  const estimate=useMemo(()=>{
    if(!selected) return {usd:0,credits:0,monthlyShare:0,overage:0,totalTokens:0};
    const inputTokens=Math.max(0,Math.floor(Number(input)||0));
    const outputTokens=Math.max(0,Math.floor(Number(output)||0));
    const providerUsd=(inputTokens/1_000_000)*selected.inputUsdPer1M+(outputTokens/1_000_000)*selected.outputUsdPer1M;
    const providerMicros=Math.ceil(providerUsd*1_000_000);
    const credits=Math.max(providerMicros>0?1:0,Math.ceil((providerMicros/1000)*(selected.creditMultiplierBps/100)));
    return {
      usd:providerUsd,
      credits,
      monthlyShare:monthlyCredits?Math.min(100,(credits/monthlyCredits)*100):0,
      overage:overageCreditPriceToman>0?credits*overageCreditPriceToman:0,
      totalTokens:inputTokens+outputTokens,
    };
  },[selected,input,output,monthlyCredits,overageCreditPriceToman]);

  if(!models.length) return null;

  return (
    <section className="cortex-panel rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="cortex-kicker">COST SIMULATOR</p>
          <h3 className="mt-2 text-xl font-bold">تخمین مصرف قبل از اجرا</h3>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">هزینه خام مدل و اعتبار تقریبی Cortex را برای یک درخواست شبیه‌سازی کن. عدد واقعی بعد از اجرا از توکن‌های واقعی ثبت می‌شود.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-[10px] text-primary"><Calculator className="size-3.5"/>محاسبه سریع</div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="rounded-xl border border-white/[.06] bg-white/[.018] p-3">
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground"><Gauge className="size-3.5"/>مدل</span>
            <select value={modelId} onChange={e=>setModelId(e.target.value)} className="mt-2 w-full bg-transparent text-sm font-semibold outline-none">
              {models.map(m=><option key={m.id} value={m.id}>{m.provider} · {m.displayName}{m.enabledForPlan?"":" · خارج از پلن"}</option>)}
            </select>
          </label>
          <div className="rounded-xl border border-white/[.06] bg-white/[.018] p-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Sigma className="size-3.5"/>نرخ مرجع</div>
            <p className="mt-2 text-sm font-semibold">\${selected.inputUsdPer1M} ورودی · \${selected.outputUsdPer1M} خروجی / ۱M</p>
          </div>
          <label className="rounded-xl border border-white/[.06] bg-white/[.018] p-3">
            <span className="text-[11px] text-muted-foreground">توکن ورودی</span>
            <input type="number" min={0} max={1000000000} inputMode="numeric" value={input} onChange={e=>setInput(Number(e.target.value))} className="mt-2 w-full bg-transparent text-lg font-bold outline-none" />
          </label>
          <label className="rounded-xl border border-white/[.06] bg-white/[.018] p-3">
            <span className="text-[11px] text-muted-foreground">توکن خروجی</span>
            <input type="number" min={0} max={1000000000} inputMode="numeric" value={output} onChange={e=>setOutput(Number(e.target.value))} className="mt-2 w-full bg-transparent text-lg font-bold outline-none" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-primary/15 bg-primary/[.05] p-4"><p className="text-[10px] text-muted-foreground">هزینه خام مدل</p><p className="mt-3 text-2xl font-black">\${estimate.usd.toFixed(6)}</p><p className="mt-1 text-[10px] text-muted-foreground">{faNum(estimate.totalTokens)} توکن</p></div>
          <div className="rounded-2xl border border-violet-400/15 bg-violet-400/[.05] p-4"><p className="text-[10px] text-muted-foreground">اعتبار Cortex</p><p className="mt-3 text-2xl font-black">{faNum(estimate.credits)}</p><p className="mt-1 text-[10px] text-muted-foreground">{estimate.monthlyShare.toFixed(2)}٪ از سهم ماهانه</p></div>
          <div className="col-span-2 rounded-2xl border border-amber-400/10 bg-amber-400/[.035] p-4">
            <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">مبلغ مازاد تخمینی</span><Coins className="size-4 text-amber-300"/></div>
            <p className="mt-2 text-sm font-bold">{overageCreditPriceToman>0?faNum(Math.ceil(estimate.overage))+" تومان":"طبق پلن فعلی محاسبه نمی‌شود"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
