"use client";

import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Bot, CheckCircle2, FileText, MessageCircle, PlayCircle, Send, Settings2, Sparkles } from "lucide-react";
import { useCortexStore } from "@/components/cortex/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STEPS = [
  { n: "۱", icon: Bot, title: "ایجنت خودت را بساز", text: "نام، نقش، لحن و شخصیت دستیار را مشخص کن. لازم نیست کدنویسی بلد باشی.", view: "agent-new" as const },
  { n: "۲", icon: FileText, title: "دانش را وصل کن", text: "فایل‌ها، داده‌های ساختاریافته یا صفحات وب را اضافه کن تا پاسخ‌ها به اطلاعات واقعی تو متکی شوند.", view: "knowledge" as const },
  { n: "۳", icon: MessageCircle, title: "در پلی‌گراند امتحان کن", text: "با ایجنت گفتگو کن، منابع بازیابی‌شده را ببین و قبل از انتشار رفتارش را اصلاح کن.", view: "agents" as const },
  { n: "۴", icon: Send, title: "به تلگرام وصلش کن", text: "توکن ربات را وارد کن؛ سیستم اتصال Webhook را برقرار می‌کند و کاربران را مدیریت می‌کند.", view: "telegram" as const },
  { n: "۵", icon: Settings2, title: "تنظیمات را دقیق کن", text: "مدل، خلاقیت، حافظه، محدودیت مصرف و اتصال سرویس هوش مصنوعی را کنترل کن.", view: "settings" as const },
];

export function LearnView() {
  const setView = useCortexStore((s) => s.setView);
  return (
    <div className="space-y-7">
      <section className="cortex-panel relative overflow-hidden rounded-[28px] p-6 sm:p-8">
        <div className="absolute -end-16 -top-24 size-72 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute -start-10 -bottom-24 size-64 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="flex items-center gap-2 text-primary"><BookOpen className="size-5"/><span className="text-sm font-semibold">آموزش ساده</span></div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">از صفر تا یک دستیار واقعی.</h2>
          <p className="mt-3 text-sm leading-8 text-muted-foreground">این مسیر برای کاربری طراحی شده که نمی‌خواهد درگیر جزئیات فنی شود. هر مرحله را انجام بده و نتیجه را همان لحظه ببین.</p>
          <Button className="mt-6" onClick={() => setView("agent-new")}><Sparkles/>شروع ساخت اولین ایجنت</Button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {STEPS.map((step, i) => (
          <motion.div key={step.n} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*.05}} whileHover={{y:-3}}>
            <Card className="cortex-panel h-full rounded-2xl">
              <CardContent className="flex h-full gap-4 p-5 sm:p-6">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary font-bold">{step.n}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><step.icon className="size-4 text-primary"/><h3 className="font-semibold">{step.title}</h3></div>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{step.text}</p>
                  <Button variant="ghost" size="sm" className="mt-3 px-0 text-primary" onClick={() => setView(step.view)}>رفتن به این بخش <ArrowLeft/></Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: CheckCircle2, title: "پاسخ واقعی", text: "اگر سرویس مدل تنظیم نشده باشد، سیستم پاسخ ساختگی تولید نمی‌کند." },
          { icon: PlayCircle, title: "آزمایش قبل از انتشار", text: "پلی‌گراند برای بررسی پاسخ‌ها و منابع واقعی ایجنت است." },
          { icon: BookOpen, title: "قابل یادگیری", text: "هر زمان می‌توانی دانش، شخصیت یا تنظیمات ایجنت را تغییر بدهی." },
        ].map((item) => <Card key={item.title} className="cortex-panel rounded-2xl"><CardContent className="p-5"><item.icon className="size-5 text-primary"/><p className="mt-4 font-semibold">{item.title}</p><p className="mt-1 text-xs leading-6 text-muted-foreground">{item.text}</p></CardContent></Card>)}
      </section>
    </div>
  );
}
