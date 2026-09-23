"use client";

import { motion } from "framer-motion";
import { Activity, BarChart3, Bot, BrainCircuit, Plug, ShieldCheck, Sparkles, Users, Workflow } from "lucide-react";
import type { View } from "@/components/cortex/store";
import { cn } from "@/lib/utils";

type Capability = {
  title: string;
  eyebrow: string;
  description: string;
  icon: typeof BrainCircuit;
  status: "active" | "soon";
  view?: View;
};

const CAPABILITIES: Capability[] = [
  { title: "Company Brain", eyebrow: "مغز شرکت", description: "فایل‌ها، وب‌سایت‌ها و دانش واقعی را یک‌جا مدیریت کن و پاسخ‌های ایجنت را به آن وصل کن.", icon: BrainCircuit, status: "active", view: "knowledge" },
  { title: "Agent Studio", eyebrow: "استودیو ایجنت", description: "ایجنت را با شخصیت، لحن، دستورالعمل، حافظه، مدل و تنظیمات پیشرفته بدون کدنویسی بساز.", icon: Bot, status: "active", view: "agents" },
  { title: "Business Analytics / ROI", eyebrow: "تحلیل و بینش", description: "مصرف واقعی، هزینه ثبت‌شده، روند فعالیت، کانال‌ها و شکاف دانش را از داده‌های واقعی ببین.", icon: BarChart3, status: "active", view: "analytics" },
  { title: "Workflow Automation", eyebrow: "اتوماسیون", description: "رویدادها را به تصمیم‌های AI و اقدام‌های خودکار متصل کن.", icon: Workflow, status: "soon" },
  { title: "AI Employees / Multi-Agent", eyebrow: "نیروی کار AI", description: "چند ایجنت را برای اجرای وظایف و نقش‌های مختلف کنار هم قرار بده.", icon: Users, status: "soon" },
  { title: "Integrations", eyebrow: "اتصال‌ها", description: "سرویس‌ها، CRMها، ایمیل و ابزارهای کاری را از یک لایه اتصال واحد مدیریت کن.", icon: Plug, status: "soon" },
  { title: "Human + AI Collaboration", eyebrow: "همکاری انسان و AI", description: "برای کارهای حساس، تأیید انسانی و تحویل گفتگو را وارد جریان کن.", icon: ShieldCheck, status: "soon" },
  { title: "AI Command Center", eyebrow: "فرماندهی", description: "از یک مرکز واحد وضعیت کسب‌وکار، ایجنت‌ها و عملیات را کنترل کن.", icon: Sparkles, status: "soon" },
  { title: "AI Business Simulator", eyebrow: "شبیه‌ساز", description: "سناریوهای کسب‌وکار را قبل از اقدام با داده و فرض‌های قابل مشاهده بررسی کن.", icon: Activity, status: "soon" },
];

export function Capabilities({ onOpen }: { onOpen: (view: View) => void }) {
  return (
    <section aria-labelledby="cortex-capabilities" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="cortex-kicker">PRODUCT CORE</p>
          <h2 id="cortex-capabilities" className="mt-2 text-xl font-bold text-foreground sm:text-2xl">هسته Cortex</h2>
          <p className="mt-1 text-sm text-muted-foreground">سه بخش همین حالا فعال‌اند؛ شش بخش بعدی شفاف و بدون داده ساختگی در «به‌زودی» قرار گرفته‌اند.</p>
        </div>
        <span className="hidden rounded-full border border-white/[.07] bg-white/[.02] px-3 py-1.5 text-[10px] text-muted-foreground sm:inline-flex">۳ فعال · ۶ به‌زودی</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CAPABILITIES.map((item, index) => {
          const Icon = item.icon;
          const active = item.status === "active";
          return (
            <motion.div key={item.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: Math.min(index * 0.025, 0.18) }} className="h-full">
              <button type="button" disabled={!active} onClick={() => item.view && onOpen(item.view)} className={cn("group relative flex h-full min-h-[178px] w-full flex-col rounded-2xl border p-4 text-start transition-all", active ? "border-white/[.08] bg-white/[.018] hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[.025]" : "cursor-default border-white/[.06] bg-white/[.012] opacity-80")}>
                <div className="flex items-start justify-between gap-3">
                  <span className={cn("cortex-icon-box", active ? "" : "border-white/[.07] bg-white/[.02] text-muted-foreground shadow-none")}><Icon className="size-[18px]" /></span>
                  <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-medium", active ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-300" : "border-amber-400/15 bg-amber-400/10 text-amber-200")}>{active ? "فعال" : "به‌زودی"}</span>
                </div>
                <div className="mt-5">
                  <p className="text-[10px] font-bold tracking-[.18em] text-primary/70">{item.eyebrow}</p>
                  <h3 className="mt-1 text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">{item.description}</p>
                </div>
                {active && <span className="mt-auto pt-4 text-[10px] font-medium text-primary transition-transform group-hover:-translate-x-1">ورود به بخش ←</span>}
              </button>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
