"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpLeft,
  BookOpen,
  Bot,
  Check,
  FileSearch,
  MessageSquare,
  Menu,
  X,
  Network,
  Play,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { CortexLogo, CortexMark } from "@/components/cortex/logo";
import { ThemeToggle } from "@/components/cortex/theme-toggle";

const FEATURES = [
  {
    icon: BookOpen,
    title: "دانش سازمان",
    text: "PDF، متن و URL را وارد کن و دانش قابل جست‌وجو برای Agent بساز.",
  },
  {
    icon: Bot,
    title: "Agent Builder",
    text: "رفتار، لحن، حافظه، ابزار و محدودیت‌های Agent را کنترل کن.",
  },
  {
    icon: FileSearch,
    title: "پاسخ با منبع",
    text: "پاسخ‌ها را بر پایه دانش واقعی سازمان و ارجاع به منبع بررسی کن.",
  },
  {
    icon: Network,
    title: "اتصال به کسب‌وکار",
    text: "Agent را به Telegram و جریان‌های عملیاتی شرکت وصل کن.",
  },
];

const PLANS = [
  { name: "Launch", price: "۳٬۹۰۰٬۰۰۰", credits: "۱۵٬۰۰۰ اعتبار", text: "شروع هوشمندانه — برای راه‌اندازی سریع", detail: "مدل‌های سریع و اقتصادی", featured: false },
  { name: "Growth", price: "۱۲٬۹۰۰٬۰۰۰", credits: "۸۰٬۰۰۰ اعتبار", text: "تعادل ایده‌آل بین قدرت و هزینه", detail: "مدل‌های با کیفیت بالاتر + تحلیل دقیق", featured: true },
  { name: "Scale", price: "۲۴٬۹۰۰٬۰۰۰", credits: "۱۸۰٬۰۰۰ اعتبار", text: "قدرت واقعی اتوماسیون برای مصرف سنگین", detail: "مدل‌های قوی‌تر + اولویت پاسخ", featured: false },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  function go(path: "/login" | "/signup") {
    window.location.href = path;
  }

  return (
    <main id="top" dir="rtl" className="cortex-landing min-h-dvh overflow-x-hidden overflow-y-visible bg-background pb-20 text-foreground sm:pb-0">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#top" className="shrink-0" aria-label="Cortex AI">
            <CortexLogo markSize={34} />
          </a>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">ویژگی‌ها</a>
            <a href="#how-it-works" className="transition hover:text-foreground">چطور کار می‌کند؟</a>
            <a href="#pricing" className="transition hover:text-foreground">قیمت‌گذاری</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => go("/login")} className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground sm:inline-flex">ورود</button>
            <button onClick={() => go("/signup")} className="hidden items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_10px_30px_rgba(59,130,255,.22)] transition hover:-translate-y-0.5 sm:inline-flex">شروع کنید <ArrowUpLeft className="size-4" /></button>
            <button
              type="button"
              aria-label="باز کردن منوی سایت"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex size-10 items-center justify-center rounded-xl border border-border/70 bg-card/70 text-foreground sm:hidden"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-x-0 top-16 z-40 border-b border-border/60 bg-background/95 px-4 py-3 shadow-2xl backdrop-blur-xl sm:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1">
            {[
              ["#features", "ویژگی‌ها"],
              ["#how-it-works", "چطور کار می‌کند؟"],
              ["#pricing", "قیمت‌گذاری"],
            ].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">{label}</a>
            ))}
            <button onClick={() => go("/login")} className="mt-1 rounded-xl border border-border/70 px-3 py-3 text-right text-sm font-semibold">ورود</button>
            <button onClick={() => go("/signup")} className="rounded-xl bg-primary px-3 py-3 text-right text-sm font-bold text-primary-foreground">شروع کنید</button>
          </nav>
        </div>
      )}

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(59,130,255,.15),transparent_25%),radial-gradient(circle_at_82%_22%,rgba(139,92,246,.12),transparent_24%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-18 pt-14 sm:px-6 lg:grid-cols-[.94fr_1.06fr] lg:px-8 lg:pb-24 lg:pt-20">
          <motion.div initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .45 }} className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[.06] px-3 py-1.5 text-[10px] font-bold tracking-[.15em] text-primary">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.85)]" />
              PRIVATE AI WORKSPACE
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.35] tracking-tight sm:text-5xl lg:text-6xl">
              ایجنت‌های هوش مصنوعی را از
              <span className="bg-gradient-to-l from-primary via-blue-400 to-violet-400 bg-clip-text text-transparent"> دانش خودتان </span>
              بسازید.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-muted-foreground sm:text-base">
              Cortex AI دانش، Agent، Telegram، مصرف مدل و اعتبار را در یک محیط کاری حرفه‌ای برای شرکت‌ها جمع می‌کند.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={() => go("/signup")} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-black text-primary-foreground shadow-[0_14px_40px_rgba(59,130,255,.25)] transition hover:-translate-y-1">شروع کنید <ArrowLeft className="size-4" /></button>
              <a href="#features" className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-card/60 px-5 py-3.5 text-sm font-bold transition hover:-translate-y-1 hover:border-primary/20">مشاهده ویژگی‌ها <Play className="size-4" /></a>
            </div>
            <div className="mt-7 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <span className="rounded-full border border-border/60 bg-card/50 px-3 py-1.5">تست قبل از خرید</span>
              <span className="rounded-full border border-border/60 bg-card/50 px-3 py-1.5">کنترل اعتبار و مصرف</span>
              <span className="rounded-full border border-border/60 bg-card/50 px-3 py-1.5">مناسب تیم و شرکت</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: .08 }} className="relative">
            <div className="absolute -inset-5 rounded-[38px] bg-primary/[.08] blur-3xl" />
            <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#09101a] p-3 shadow-[0_40px_100px_rgba(0,0,0,.35)]">
              <div className="flex items-center justify-between border-b border-white/[.06] px-3 py-3">
                <div className="flex items-center gap-2"><CortexMark size={26} /><span className="text-xs font-bold text-white">Cortex Workspace</span></div>
                <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2 py-1 text-[8px] font-bold text-emerald-300">CONNECTED</span>
              </div>
              <div className="grid gap-3 p-3 sm:grid-cols-[1.1fr_.9fr]">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
                    <div className="flex items-center justify-between"><span className="text-[9px] font-bold tracking-[.18em] text-blue-300">CORTEX AGENT</span><Bot className="size-4 text-blue-300" /></div>
                    <p className="mt-3 text-lg font-black text-white">پشتیبان فروش</p>
                    <p className="mt-1 text-[10px] leading-5 text-slate-400">RAG فعال · Telegram متصل · پاسخ با منبع</p>
                    <div className="mt-4 flex gap-2"><span className="rounded-full bg-blue-400/10 px-2 py-1 text-[8px] text-blue-200">Knowledge</span><span className="rounded-full bg-violet-400/10 px-2 py-1 text-[8px] text-violet-200">Tools</span><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[8px] text-emerald-200">Ready</span></div>
                  </div>
                  <div className="rounded-2xl border border-white/[.07] bg-white/[.02] p-4">
                    <div className="flex items-center justify-between"><span className="text-[9px] text-slate-400">دانش سازمان</span><BookOpen className="size-4 text-violet-300" /></div>
                    <div className="mt-3 space-y-2">
                      {["راهنمای محصول.pdf", "قوانین فروش و بازگشت", "FAQ شرکت"].map((x) => <div key={x} className="flex items-center gap-2 rounded-xl border border-white/[.05] bg-white/[.018] px-3 py-2"><FileSearch className="size-3.5 text-violet-300" /><span className="truncate text-[10px] text-slate-300">{x}</span><Check className="ms-auto size-3 text-emerald-300" /></div>)}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/[.07] bg-gradient-to-br from-blue-400/[.12] to-violet-400/[.08] p-4">
                    <div className="flex items-center justify-between"><span className="text-[9px] text-slate-400">اعتبار</span><WalletCards className="size-4 text-blue-300" /></div>
                    <p className="mt-3 text-3xl font-black text-white">۸۶٬۲۴۰</p>
                    <p className="mt-1 text-[9px] text-slate-400">اعتبار باقی‌مانده</p>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[68%] rounded-full bg-gradient-to-r from-blue-400 to-violet-400" /></div>
                    <p className="mt-2 text-[8px] text-slate-500">مصرف این ماه: ۳۲٪</p>
                  </div>
                  <div className="rounded-2xl border border-white/[.07] bg-white/[.02] p-4">
                    <div className="flex items-center justify-between"><span className="text-[9px] text-slate-400">مصرف مدل‌ها</span><MessageSquare className="size-4 text-emerald-300" /></div>
                    <div className="mt-3 space-y-3">
                      {[["DeepSeek", "۴۱٪", "41%"], ["GPT-5.6", "۳۴٪", "34%"], ["Gemini", "۲۵٪", "25%"]].map(([x, label, width]) => <div key={x}><div className="flex justify-between text-[9px] text-slate-400"><span>{x}</span><span>{label}</span></div><div className="mt-1 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-violet-400" style={{ width }} /></div></div>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="scroll-mt-20 border-y border-border/60 bg-card/25">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="cortex-kicker">CORE CAPABILITIES</p>
            <h2 className="mt-3 text-3xl font-black">همه‌چیز برای ساخت یک AI عملیاتی.</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">از دانش اختصاصی تا Bot و کنترل هزینه، هر بخش برای استفاده واقعی کسب‌وکار ساخته شده است.</p>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((feature, index) => (
              <motion.article key={feature.title} whileHover={{ y: -5 }} transition={{ duration: .18 }} className="rounded-[22px] border border-border/65 bg-card/70 p-5 shadow-[0_18px_50px_rgba(15,23,42,.06)]">
                <span className="grid size-11 place-items-center rounded-2xl border border-primary/15 bg-primary/[.07] text-primary"><feature.icon className="size-5" /></span>
                <span className="mt-5 block text-[9px] font-bold tracking-[.18em] text-muted-foreground">۰{index + 1}</span>
                <h3 className="mt-2 text-base font-black">{feature.title}</h3>
                <p className="mt-2 text-xs leading-7 text-muted-foreground">{feature.text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="cortex-kicker">HOW IT WORKS</p>
              <h2 className="mt-3 text-3xl font-black">از ایده تا Agent در سه قدم.</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">مسیر اصلی را عمداً کوتاه نگه داشته‌ایم تا تیم شرکت بدون آموزش پیچیده به اولین خروجی برسد.</p>
              <button onClick={() => go("/signup")} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">شروع کنید <ArrowLeft className="size-4" /></button>
            </div>
            <div className="space-y-3">
              {[
                ["۰۱", "دانش را وارد کن", "فایل PDF، متن یا URL را وارد کن تا دانش سازمان آماده شود."],
                ["۰۲", "Agent را بساز", "لحن، قوانین، حافظه و ابزارهای Agent را تعیین کن."],
                ["۰۳", "تست و انتشار", "در Playground تست کن و بعد آن را به Telegram یا جریان کاری وصل کن."],
              ].map(([n, title, text]) => (
                <div key={n} className="flex gap-4 rounded-[22px] border border-border/65 bg-card/65 p-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-xs font-black text-primary">{n}</span>
                  <div><h3 className="text-sm font-black">{title}</h3><p className="mt-1 text-xs leading-6 text-muted-foreground">{text}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-20 border-y border-border/60 bg-card/25">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="cortex-kicker">PRICING</p>
            <h2 className="mt-3 text-3xl font-black">با نیاز واقعی شرکتت شروع کن.</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">همه پلن‌ها اعتبار مشخص دارند و مصرف اضافه شفاف است؛ برای مصرف سازمانی هم Enterprise سفارشی داریم.</p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <article key={plan.name} className={plan.featured ? "relative overflow-hidden rounded-[26px] border border-primary/30 bg-primary/[.07] p-6 shadow-[0_24px_70px_rgba(59,130,255,.12)]" : "rounded-[26px] border border-border/65 bg-card/70 p-6"}>
                {plan.featured && <span className="absolute end-4 top-4 rounded-full bg-primary px-2.5 py-1 text-[8px] font-bold text-primary-foreground">پیشنهاد تیمی</span>}
                <h3 className="text-lg font-black">{plan.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{plan.text}</p>
                <p className="mt-1 text-[10px] text-primary/80">{plan.detail}</p>
                <p className="mt-6 text-3xl font-black">{plan.price}<span className="ms-1 text-[11px] font-semibold text-muted-foreground">تومان / ماه</span></p>
                <p className="mt-2 text-xs text-primary">{plan.credits}</p>
                <div className="mt-5 space-y-2 text-xs text-muted-foreground">
                  {["Agent و Knowledge Base", "مدل‌های مدیریت‌شده Cortex", "Telegram و کنترل مصرف"].map((x) => <div key={x} className="flex items-center gap-2"><Check className="size-3.5 text-emerald-400" />{x}</div>)}
                </div>
                <button onClick={() => go("/signup")} className={plan.featured ? "mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" : "mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/45 px-4 py-3 text-sm font-bold"}>شروع با {plan.name} <ArrowUpLeft className="size-4" /></button>
              </article>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-background/40 p-4 text-center text-xs text-muted-foreground">
            <strong className="text-foreground">Enterprise:</strong> برای مصرف بالا، مدل‌های خاص، چند Bot، SLA و تنظیمات اختصاصی از ۳۵٬۰۰۰٬۰۰۰ تومان؛ جزئیات بر اساس قرارداد تعیین می‌شود.
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[24px] border border-border/65 bg-card/65 p-5">
              <ShieldCheck className="size-5 text-emerald-400" />
              <h3 className="mt-4 text-sm font-black">کنترل داده و دسترسی</h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">فضای کاری، Agent و مصرف هر شرکت از یکدیگر جدا می‌ماند.</p>
            </div>
            <div className="rounded-[24px] border border-border/65 bg-card/65 p-5">
              <WalletCards className="size-5 text-primary" />
              <h3 className="mt-4 text-sm font-black">هزینه شفاف</h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">مشتری می‌بیند چه مدلی چقدر مصرف کرده و چه مقدار اعتبار باقی مانده است.</p>
            </div>
            <div className="rounded-[24px] border border-border/65 bg-card/65 p-5">
              <Sparkles className="size-5 text-violet-400" />
              <h3 className="mt-4 text-sm font-black">ساخته‌شده برای رشد</h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">از تست یک Agent تا سناریوی چند Bot و مصرف سازمانی مسیر رشد مشخص است.</p>
            </div>
          </div>
          <div className="mt-5 rounded-[24px] border border-border/65 bg-card/55 p-5 text-center text-xs text-muted-foreground">
            فضای لوگوی مشتریان آینده Cortex — این بخش بعد از اولین مشتری‌های رسمی تکمیل می‌شود.
          </div>
        </div>
      </section>

      <div className="fixed inset-x-3 bottom-3 z-40 flex gap-2 rounded-2xl border border-border/70 bg-background/90 p-2 shadow-2xl backdrop-blur-xl sm:hidden">
        <a href="#pricing" className="flex-1 rounded-xl border border-border/70 px-3 py-2.5 text-center text-xs font-bold">دیدن قیمت‌ها</a>
        <button onClick={() => go("/signup")} className="flex-[1.2] rounded-xl bg-primary px-3 py-2.5 text-center text-xs font-black text-primary-foreground">شروع کنید</button>
      </div>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div><CortexLogo markSize={30} /><p className="mt-2 text-[10px] text-muted-foreground">AI Workspace برای شرکت‌ها و کسب‌وکارها</p></div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <a href="#features" className="hover:text-foreground">ویژگی‌ها</a>
            <a href="#pricing" className="hover:text-foreground">قیمت‌گذاری</a>
            <a href="/login" className="hover:text-foreground">ورود</a>
            <a href="/signup" className="hover:text-foreground">ثبت‌نام</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

