"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, Gauge, MessageSquare, Orbit, Sigma, Zap } from "lucide-react";
import { faNum } from "@/components/cortex/format";
import { api } from "@/lib/cortex-client";

type EstimatorModel = {
  id:string; provider:string; modelId:string; displayName:string;
  inputUsdPer1M:number; outputUsdPer1M:number; qualityTier:string; speedTier:string;
  creditMultiplierBps:number; enabledForPlan:boolean;
};
type FxDto = { usdToman:number; source:string; asOf:string; stale:boolean };
type Props = { models:EstimatorModel[]; monthlyCredits:number; overageCreditPriceToman:number };

function money(value:number){ return value >= 1 ? value.toFixed(2) : value.toFixed(6); }

export function BillingEstimator({models,monthlyCredits}:Props){
  const available=models.filter(m=>m.enabledForPlan);
  const [modelId,setModelId]=useState(available[0]?.id ?? models[0]?.id ?? "");
  const [input,setInput]=useState(4_000);
  const [output,setOutput]=useState(1_200);
  const [messages,setMessages]=useState(100);
  const [tasks,setTasks]=useState(10);

  const fxQuery=useQuery<FxDto>({
    queryKey:["billing-fx"],
    queryFn:()=>api.getBillingFx(),
    staleTime:10*60_000,
    refetchInterval:15*60_000,
  });
  const selected=useMemo(()=>models.find(m=>m.id===modelId)??models[0], [modelId,models]);
  const fx=fxQuery.data?.usdToman ?? 235_175;

  const estimate=useMemo(()=>{
    if(!selected) return {messageUsd:0,taskUsd:0,monthlyUsd:0,monthlyToman:0,tokens:0,monthlyCredits:0};
    const inTokens=Math.max(0,Math.floor(Number(input)||0));
    const outTokens=Math.max(0,Math.floor(Number(output)||0));
    const msgCount=Math.max(0,Math.floor(Number(messages)||0));
    const taskCount=Math.max(0,Math.floor(Number(tasks)||0));
    const tokens=inTokens+outTokens;
    const messageUsd=(inTokens/1_000_000)*selected.inputUsdPer1M+(outTokens/1_000_000)*selected.outputUsdPer1M;
    const taskUsd=messageUsd*2.2;
    const providerMicros=Math.ceil(messageUsd*1_000_000);
    const credits=Math.max(providerMicros>0?1:0,Math.ceil((providerMicros/1000)*(selected.creditMultiplierBps/100)));
    const monthlyUsd=messageUsd*msgCount+taskUsd*taskCount;
    const monthlyCredits=credits*msgCount+Math.ceil(credits*2.2)*taskCount;
    return {messageUsd,taskUsd,monthlyUsd,monthlyToman:monthlyUsd*fx,tokens,monthlyCredits};
  },[selected,input,output,messages,tasks,fx]);

  if(!models.length) return null;
  const planShare=monthlyCredits?Math.round((estimate.monthlyCredits/monthlyCredits)*100):0;

  return (
    <section className="cortex-estimator relative overflow-hidden rounded-[26px] border border-primary/15 p-5 sm:p-6">
      <div className="pointer-events-none absolute -end-16 -top-20 size-52 rounded-full bg-primary/10 blur-3xl"/>
      <div className="pointer-events-none absolute -start-12 -bottom-20 size-56 rounded-full bg-violet-500/10 blur-3xl"/>
      <div className="relative">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2"><span className="cortex-kicker">CORTEX COST LAB</span><span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary"><Orbit className="size-3.5"/></span></div>
            <h3 className="mt-2 text-xl font-black">قبل از اجرا، هزینه را ببین.</h3>
            <p className="mt-1 max-w-2xl text-xs leading-6 text-muted-foreground">تعداد توکن، پیام و تسک را تغییر بده و بودجه تقریبی را به دلار، تومان و اعتبار Cortex ببین.</p>
          </div>
          <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-[10px] text-primary">۱ USD ≈ {faNum(fx)} تومان</div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-2xl border border-border/60 bg-background/50 p-3">
              <span className="flex items-center gap-2 text-[11px] text-muted-foreground"><Gauge className="size-3.5"/>مدل</span>
              <select value={modelId} onChange={e=>setModelId(e.target.value)} className="mt-2 w-full bg-transparent text-sm font-semibold outline-none">
                {models.map(m=><option key={m.id} value={m.id}>{m.provider} · {m.displayName}{m.enabledForPlan?"":" · خارج از پلن"}</option>)}
              </select>
            </label>
            <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Sigma className="size-3.5"/>نرخ مدل</div>
              <p className="mt-2 text-sm font-semibold">$${money(selected.inputUsdPer1M)} ورودی · $${money(selected.outputUsdPer1M)} خروجی / ۱M</p>
              <p className="mt-1 text-[9px] text-muted-foreground">{selected.qualityTier} · {selected.speedTier}</p>
            </div>
            {[
              ["توکن ورودی",input,setInput],
              ["توکن خروجی",output,setOutput],
              ["تعداد پیام",messages,setMessages],
              ["تعداد تسک",tasks,setTasks],
            ].map(([label,value,setter],i)=>
              <label key={String(label)} className="rounded-2xl border border-border/60 bg-background/50 p-3">
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">{i<2?<Sigma className="size-3.5"/>:i===2?<MessageSquare className="size-3.5"/>:<Zap className="size-3.5"/>}{String(label)}</span>
                <input type="number" min={0} max={1000000000} inputMode="numeric" value={Number(value)} onChange={e=>(setter as (n:number)=>void)(Number(e.target.value))} className="mt-2 w-full bg-transparent text-lg font-black outline-none"/>
              </label>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <motion.div whileHover={{y:-2}} className="rounded-2xl border border-primary/20 bg-primary/[.055] p-4">
              <p className="text-[10px] text-muted-foreground">یک پیام</p>
              <p className="mt-2 text-2xl font-black">$${money(estimate.messageUsd)}</p>
              <p className="mt-1 text-[11px] font-bold">{faNum(Math.round(estimate.messageUsd*fx))} تومان</p>
            </motion.div>
            <motion.div whileHover={{y:-2}} className="rounded-2xl border border-violet-400/20 bg-violet-400/[.055] p-4">
              <p className="text-[10px] text-muted-foreground">یک تسک</p>
              <p className="mt-2 text-2xl font-black">$${money(estimate.taskUsd)}</p>
              <p className="mt-1 text-[11px] font-bold">{faNum(Math.round(estimate.taskUsd*fx))} تومان</p>
            </motion.div>
            <div className="sm:col-span-2 rounded-2xl border border-border/60 bg-background/45 p-4">
              <div className="flex items-end justify-between gap-3">
                <div><p className="text-[10px] text-muted-foreground">سناریوی انتخابی</p><p className="mt-1 text-lg font-black">{faNum(messages)} پیام + {faNum(tasks)} تسک</p></div>
                <span className="text-xs font-bold text-primary">{faNum(estimate.monthlyCredits)} اعتبار</span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted"><motion.div initial={{width:0}} animate={{width:Math.min(100,Math.max(4,estimate.monthlyUsd*fx/20_000_000*100))+"%"}} transition={{duration:.45}} className="h-full rounded-full bg-gradient-to-r from-primary via-sky-400 to-violet-400"/></div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="توکن" value={faNum(estimate.tokens)}/>
                <Metric label="USD" value={"$"+money(estimate.monthlyUsd)}/>
                <Metric label="تومان" value={faNum(Math.round(estimate.monthlyToman))}/>
                <Metric label="سهم پلن" value={planShare>999?"بیش از 999٪":faNum(planShare)+"٪"}/>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-[9px] text-muted-foreground">
          <span>نرخ FX: {fxQuery.isLoading ? "در حال دریافت…" : fxQuery.data?.stale ? "آخرین نرخ مرجع در دسترس" : "تازه‌شده خودکار"} · {fxQuery.data?.source ?? "TGJU fallback"}</span>
          <span>ضریب ۲.۲× برای تخمین تسک فقط بودجه‌بندی است، نه صورتحساب نهایی.</span>
        </div>
      </div>
    </section>
  );
}

function Metric({label,value}:{label:string;value:string}) {
  return <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2"><p className="text-[9px] text-muted-foreground">{label}</p><p className="mt-1 text-xs font-black">{value}</p></div>;
}
