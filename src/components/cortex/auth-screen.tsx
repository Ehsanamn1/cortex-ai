"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileSearch, GraduationCap, Loader2, LockKeyhole, MailCheck, MessagesSquare, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { api, ApiError } from "@/lib/cortex-client";
import { CORTEX_UI_CONFIG } from "@/config/cortex-ui";
import { cn } from "@/lib/utils";
import { useCortexStore } from "@/components/cortex/store";
import { zodResolver } from "@/components/cortex/zod-resolver";
import { CortexLogo } from "@/components/cortex/logo";
import { ThemeToggle } from "@/components/cortex/theme-toggle";
import { applyCortexUiSettings } from "@/components/cortex/theme-runtime";
import { firstNameOf } from "@/components/cortex/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const loginSchema = z.object({
  email: z.email({ message: "یک ایمیل معتبر وارد کنید." }),
  password: z.string().min(8, { message: "رمز عبور باید حداقل ۸ کاراکتر باشد." }),
});
type LoginValues = z.infer<typeof loginSchema>;

const signupSchema = z.object({
  name: z.string().min(2, { message: "نام و نام خانوادگی را وارد کنید." }).max(80, { message: "نام حداکثر ۸۰ کاراکتر است." }),
  email: z.email({ message: "یک ایمیل معتبر وارد کنید." }),
  password: z.string().min(8, { message: "رمز عبور باید حداقل ۸ کاراکتر باشد." }),
});
type SignupValues = z.infer<typeof signupSchema>;

const FEATURES = [
  {
    icon: GraduationCap,
    title: "دانش سازمان خودتان را آموزش دهید",
    description: "فایل‌های PDF، متن و صفحات وب را به دانش ایجنت تبدیل کنید.",
  },
  {
    icon: FileSearch,
    title: "پاسخ‌های مبتنی بر منابع واقعی",
    description: "هر پاسخ همراه با ارجاع به منبعِ واقعی ارائه می‌شود.",
  },
  {
    icon: MessagesSquare,
    title: "پلی‌گراند گفتگوی زنده",
    description: "قبل از انتشار، با ایجنت خود گفتگو کنید و آن را بهبود دهید.",
  },
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs leading-relaxed text-destructive">{message}</p>;
}

function ForgotPasswordDialog({ open, onOpenChange, defaultEmail }: { open: boolean; onOpenChange: (open: boolean) => void; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail);
      setSent(false);
      setDevResetUrl(null);
    }
  }, [open, defaultEmail]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
      toast.error("یک ایمیل معتبر وارد کنید.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.requestPasswordReset(normalized);
      setSent(true);
      setDevResetUrl(result.devResetUrl ?? null);
      toast.success("اگر این ایمیل در Cortex ثبت شده باشد، لینک بازنشانی برایت ارسال می‌شود.");
    } catch (error) {
      toast.error(error instanceof ApiError || error instanceof Error ? error.message : "ارسال لینک بازنشانی ناموفق بود.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="w-[calc(100%-24px)] max-w-md rounded-[26px] border-border/70 bg-card/95 p-5 shadow-2xl backdrop-blur-2xl sm:p-7">
        <DialogHeader className="text-right">
          <div className="mb-3 grid size-12 place-items-center rounded-2xl border border-primary/15 bg-primary/10 text-primary"><LockKeyhole className="size-5" /></div>
          <DialogTitle className="text-xl font-black">فراموشی رمز عبور</DialogTitle>
          <DialogDescription className="text-xs leading-6">
            ایمیلت را وارد کن تا لینک امن بازنشانی رمز عبور برایت ارسال شود.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[.045] p-4">
              <div className="flex items-start gap-3">
                <MailCheck className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-bold">درخواست ثبت شد</p>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">صندوق ورودی و پوشه Spam را بررسی کن. لینک بازنشانی تا ۳۰ دقیقه معتبر است.</p>
                </div>
              </div>
            </div>
            {devResetUrl && (
              <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[.045] p-3">
                <p className="text-[10px] font-bold text-amber-300">لینک تست محیط توسعه</p>
                <a href={devResetUrl} className="mt-1 block break-all text-[10px] leading-5 text-muted-foreground underline">{devResetUrl}</a>
              </div>
            )}
            <Button className="w-full" variant="outline" onClick={() => onOpenChange(false)}>بستن</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-password-email">ایمیل حساب</Label>
              <Input id="forgot-password-email" type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="text-left" autoComplete="email" />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              {submitting ? "در حال ارسال لینک…" : "ارسال لینک بازنشانی"}
            </Button>
            <p className="text-center text-[10px] leading-5 text-muted-foreground">برای حفظ امنیت، حتی اگر ایمیل ثبت نشده باشد پیام مشابه نمایش داده می‌شود.</p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LoginForm({ onAuthenticated }: { onAuthenticated?: () => void }) {
  const hydrate = useCortexStore((s) => s.hydrate);
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setSubmitting(true);
    try {
      const session = await api.login(values);
      queryClient.clear();
      hydrate(session.user, session.workspaces);
      const first = firstNameOf(session.user.name);
      toast.success(first ? `${first} عزیز، خوش آمدید!` : "خوش آمدید!");
      onAuthenticated?.();
    } catch (error) {
      toast.error(error instanceof ApiError || error instanceof Error ? error.message : "ورود ناموفق بود.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="login-email">ایمیل</Label>
        <Input
          id="login-email"
          type="email"
          dir="ltr"
          autoComplete="email"
          placeholder="you@company.com"
          className="text-left"
          aria-invalid={!!form.formState.errors.email}
          {...form.register("email")}
        />
        <FieldError message={form.formState.errors.email?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">رمز عبور</Label>
        <Input
          id="login-password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          placeholder="••••••••"
          className="text-left"
          aria-invalid={!!form.formState.errors.password}
          {...form.register("password")}
        />
        <FieldError message={form.formState.errors.password?.message} />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setForgotOpen(true)}
          className="text-xs font-semibold text-primary transition hover:text-primary/80"
        >
          فراموشی رمز عبور؟
        </button>
      </div>
      <Button type="submit" className="cortex-auth-submit w-full" disabled={submitting}>
        {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
        {submitting ? "در حال ورود..." : "ورود به حساب"}
      </Button>
      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} defaultEmail={form.getValues("email")} />
    </form>
  );
}

function SignupForm({ onAuthenticated }: { onAuthenticated?: () => void }) {
  const hydrate = useCortexStore((s) => s.hydrate);
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: SignupValues) {
    setSubmitting(true);
    try {
      const session = await api.signup(values);
      queryClient.clear();
      hydrate(session.user, session.workspaces);
      const first = firstNameOf(session.user.name);
      toast.success(first ? `${first} عزیز، حساب شما ساخته شد!` : "حساب شما ساخته شد!");
      onAuthenticated?.();
    } catch (error) {
      toast.error(error instanceof ApiError || error instanceof Error ? error.message : "ثبت‌نام ناموفق بود.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="signup-name">نام و نام خانوادگی</Label>
        <Input
          id="signup-name"
          type="text"
          autoComplete="name"
          placeholder="مثلاً سارا محمدی"
          aria-invalid={!!form.formState.errors.name}
          {...form.register("name")}
        />
        <FieldError message={form.formState.errors.name?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">ایمیل</Label>
        <Input
          id="signup-email"
          type="email"
          dir="ltr"
          autoComplete="email"
          placeholder="you@company.com"
          className="text-left"
          aria-invalid={!!form.formState.errors.email}
          {...form.register("email")}
        />
        <FieldError message={form.formState.errors.email?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">رمز عبور</Label>
        <Input
          id="signup-password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          placeholder="حداقل ۸ کاراکتر"
          className="text-left"
          aria-invalid={!!form.formState.errors.password}
          {...form.register("password")}
        />
        <FieldError message={form.formState.errors.password?.message} />
      </div>
      <Button type="submit" className="cortex-auth-submit w-full" disabled={submitting}>
        {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
        {submitting ? "در حال ساخت حساب..." : "ساخت حساب و شروع"}
      </Button>
    </form>
  );
}

export function AuthScreen({ defaultTab = "login", onAuthenticated, bootNotice }: { defaultTab?: "login" | "signup"; onAuthenticated?: () => void; bootNotice?: string }) {
  const siteConfig = useQuery({ queryKey: ["site-config"], queryFn: api.getSiteConfig, staleTime: 60_000, retry: 1 });
  const settings = siteConfig.data?.settings;
  useEffect(() => {
    if (settings) applyCortexUiSettings(settings);
  }, [settings]);
  const showBrandPanel = settings?.["feature.authBrandPanel"] === undefined ? true : settings["feature.authBrandPanel"] !== "false";
  return (
    <div className="cortex-auth flex min-h-screen flex-col bg-background">
      <div className={cn("relative grid flex-1 overflow-hidden", showBrandPanel ? "lg:grid-cols-[1.18fr_.82fr]" : "lg:grid-cols-1")}>
        {/* Brand panel — right side in RTL */}
        <aside className="relative hidden min-h-full flex-col justify-between overflow-hidden border-l border-border/70 bg-[color:var(--auth-brand)] p-10 lg:flex xl:p-14">
          <div aria-hidden="true" className="cortex-grid-bg absolute inset-0 opacity-70" />
          <div aria-hidden="true" className="cortex-auth-core absolute end-[12%] top-[18%] size-48 rounded-full lg:size-64">
            <div className="cortex-auth-core-ring cortex-auth-core-ring-a" />
            <div className="cortex-auth-core-ring cortex-auth-core-ring-b" />
            <div className="cortex-auth-core-orb" />
          </div>

          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(59,130,255,.16),transparent_24%),radial-gradient(circle_at_18%_78%,rgba(139,92,246,.12),transparent_26%)]" />
          <div
            aria-hidden="true"
            className="absolute -top-32 left-0 size-96 rounded-full bg-primary/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-40 right-0 size-96 rounded-full bg-secondary/10 blur-3xl"
          />

          <div className="relative">
            <CortexLogo markSize={44} />
          </div>

          <div className="relative max-w-2xl space-y-8">
            <div className="space-y-3"><p className="text-[11px] font-bold tracking-[.22em] text-primary/80">PRIVATE AI WORKSPACE</p><h1 className="max-w-xl text-3xl font-bold leading-[1.5] text-foreground xl:text-5xl xl:leading-[1.28]">
              ایجنت‌های هوش مصنوعی را از{" "}
              <span className="bg-gradient-to-l from-primary to-secondary bg-clip-text text-transparent">
                دانش خودتان
              </span>{" "}
              بسازید.
            </h1></div>
            <ul className="space-y-5">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="group flex items-start gap-4 rounded-2xl border border-border/60 bg-muted/25 p-4 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-white/[.04]">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary shadow-[0_8px_30px_rgba(59,130,255,.08)]">
                    <feature.icon aria-hidden="true" className="size-5" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{feature.title}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

        </aside>

        {/* Auth card */}
        <div className="relative flex items-center justify-center p-5 sm:p-10 lg:bg-[radial-gradient(circle_at_20%_20%,var(--auth-glow),transparent_28%)]">
          <div className="absolute end-5 top-5 z-20"><ThemeToggle /></div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            <div className="mb-8 flex justify-center lg:hidden">
              <CortexLogo markSize={44} />
            </div>

            <div className="cortex-auth-card rounded-[28px] border border-border/70 bg-card/80 p-6 shadow-[0_28px_90px_rgba(0,0,0,.32)] backdrop-blur-2xl sm:p-8 lg:p-9">
              <div className="mb-7 space-y-2 text-center">
                <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-[10px] font-semibold tracking-[.15em] text-primary">{settings?.["site.name"] || CORTEX_UI_CONFIG.brand.name} <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.75)]" /></div><h2 className="text-2xl font-bold tracking-tight text-foreground">{settings?.["site.authTitle"] || CORTEX_UI_CONFIG.copy.authTitle}</h2>
                <p className="text-sm text-muted-foreground">{settings?.["site.authDescription"] || CORTEX_UI_CONFIG.copy.authDescription}</p>
              </div>

              {bootNotice && (
                <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-300/15 bg-amber-300/[.05] p-3 text-xs leading-6 text-amber-100/85">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
                  <p>نشست قبلی قابل بازیابی نبود و Cortex آن را پاک کرد. می‌توانید دوباره وارد شوید.</p>
                </div>
              )}

              <Tabs defaultValue={defaultTab}>
                <TabsList className="mb-7 grid h-12 w-full grid-cols-2 rounded-xl border border-border/60 bg-muted/50 p-1">
                  <TabsTrigger className="rounded-lg text-sm" value="login">ورود</TabsTrigger>
                  <TabsTrigger className="rounded-lg text-sm" value="signup">ثبت‌نام</TabsTrigger>
                </TabsList>
                <TabsContent value="login">
                  <LoginForm onAuthenticated={onAuthenticated} />
                </TabsContent>
                <TabsContent value="signup">
                  <SignupForm onAuthenticated={onAuthenticated} />
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Sticky mini footer */}
      <footer className="mt-auto border-t border-white/[.06] bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-xs text-muted-foreground">
          <span>© Cortex AI</span>
          <span>نسخه ۱.۰</span>
        </div>
      </footer>
    </div>
  );
}
