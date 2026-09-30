"use client";

import { Activity, BarChart3, Bot, BrainCircuit, MessagesSquare, Plug, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import type { View } from "@/components/cortex/store";
import { cn } from "@/lib/utils";

type Capability = { title:string; description:string; icon:typeof BrainCircuit; status:"active"|"soon"; view?:View };

const CAPABILITIES:Capability[]=[
 {title:"ایجنت‌ها",description:"ساخت و مدیریت",icon:Bot,status:"active",view:"agents"},
 {title:"مغز کسب‌وکار",description:"دانش + مصاحبه ۳۰ سؤال",icon:BrainCircuit,status:"active",view:"knowledge"},
 {title:"گفتگوها",description:"مکالمات واقعی",icon:MessagesSquare,status:"active",view:"conversations"},
 {title:"تلگرام",description:"اتصال + شخصی‌سازی + کاربران",icon:ShieldCheck,status:"active",view:"telegram"},
 {title:"تحلیل",description:"مصرف + هزینه",icon:BarChart3,status:"active",view:"analytics"},

 {title:"Workflow",description:"در حال آماده‌سازی",icon:Workflow,status:"soon"},
 {title:"اتصال‌ها",description:"CRM و سرویس‌ها",icon:Plug,status:"soon"},
 {title:"فرماندهی AI",description:"چند ایجنت",icon:Sparkles,status:"soon"},
 {title:"شبیه‌ساز",description:"سناریوهای کسب‌وکار",icon:Activity,status:"soon"},
];

export function Capabilities({onOpen}:{onOpen:(view:View)=>void}){
 return <section aria-labelledby="cortex-capabilities" className="space-y-3">
  <div className="flex items-end justify-between gap-3">
   <div><p className="cortex-kicker">QUICK ACCESS</p><h2 id="cortex-capabilities" className="mt-1 text-lg font-bold">همه‌چیز یک‌جا</h2><p className="mt-1 text-xs text-muted-foreground">دسترسی سریع به بخش‌ها و قابلیت‌ها، بدون شلوغ‌کردن منوی اصلی.</p></div>
   <span className="hidden rounded-full border border-white/[.07] bg-white/[.02] px-3 py-1.5 text-[10px] text-muted-foreground sm:inline-flex">دسترسی سریع</span>
  </div>
  <div className="rounded-2xl border border-border/70 bg-card/60 p-2 shadow-[0_12px_40px_rgba(15,23,42,.08)]">
   <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
    {CAPABILITIES.map(item=>{const Icon=item.icon;const active=item.status==="active";return <button key={item.title} type="button" disabled={!active} onClick={()=>item.view&&onOpen(item.view)} className={cn("group flex min-h-[78px] items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition-all",active?"border-transparent bg-background/55 hover:border-primary/20 hover:bg-primary/[.045]":"cursor-default border-transparent opacity-40")}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border",active?"border-primary/15 bg-primary/10 text-primary":"border-white/[.06] text-muted-foreground")}><Icon className="size-4"/></span>
      <span className="min-w-0"><span className="block truncate text-xs font-semibold text-foreground">{item.title}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{item.description}</span></span>
    </button>})}
   </div>
  </div>
 </section>;
}
