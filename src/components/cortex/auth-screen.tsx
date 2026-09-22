"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileSearch, GraduationCap, Loader2, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { api, ApiError } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { zodResolver } from "@/components/cortex/zod-resolver";
import { CortexLogo } from "@/components/cortex/logo";
import { firstNameOf } from "@/components/cortex/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const loginSchema = z.object({
  email: z.email({ message: "یک ایمیل معتبر وارد کنید." }),
  password: z.string().min(6, { message: "رمز عبور باید حداقل ۶ کاراکتر باشد." }),
});
type LoginValues = z.infer<typeof loginSchema>;

const signupSchema = z.object({
  name: z.string().min(2, { message: "نام و نام خانوادگی را وارد کنید." }).max(80, { message: "نام حداکثر ۸۰ کاراکتر است." }),
  email: z.email({ message: "یک ایمیل معتبر وارد کنید." }),
  password: z.string().min(6, { message: "رمز عبور باید حداقل ۶ کاراکتر باشد." }),
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

function LoginForm() {
  const hydrate = useCortexStore((s) => s.hydrate);
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

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
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
        {submitting ? "در حال ورود..." : "ورود به حساب"}
      </Button>
    </form>
  );
}

function SignupForm() {
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
          placeholder="حداقل ۶ کاراکتر"
          className="text-left"
          aria-invalid={!!form.formState.errors.password}
          {...form.register("password")}
        />
        <FieldError message={form.formState.errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
        {submitting ? "در حال ساخت حساب..." : "ساخت حساب و شروع"}
      </Button>
    </form>
  );
}

export function AuthScreen() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="grid flex-1 lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel — right side in RTL */}
        <aside className="relative hidden flex-col justify-between overflow-hidden border-l bg-[#0a0d13] p-12 lg:flex">
          <div aria-hidden="true" className="cortex-grid-bg absolute inset-0" />
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

          <div className="relative space-y-8">
            <h1 className="max-w-md text-3xl font-bold leading-[1.6] text-foreground xl:text-4xl xl:leading-[1.6]">
              ایجنت‌های هوش مصنوعی را از{" "}
              <span className="bg-gradient-to-l from-primary to-secondary bg-clip-text text-transparent">
                دانش خودتان
              </span>{" "}
              بسازید.
            </h1>
            <ul className="space-y-5">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex items-start gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-card text-primary">
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
        <div className="flex items-center justify-center p-6 sm:p-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            <div className="mb-8 flex justify-center lg:hidden">
              <CortexLogo markSize={44} />
            </div>

            <div className="rounded-2xl border bg-card p-6 shadow-lg shadow-black/20 sm:p-8">
              <div className="mb-6 space-y-1.5 text-center">
                <h2 className="text-xl font-bold text-foreground">به Cortex AI خوش آمدید</h2>
                <p className="text-sm text-muted-foreground">برای ادامه، وارد حساب خود شوید یا حساب جدید بسازید.</p>
              </div>

              <Tabs defaultValue="login">
                <TabsList className="mb-6 grid w-full grid-cols-2">
                  <TabsTrigger value="login">ورود</TabsTrigger>
                  <TabsTrigger value="signup">ثبت‌نام</TabsTrigger>
                </TabsList>
                <TabsContent value="login">
                  <LoginForm />
                </TabsContent>
                <TabsContent value="signup">
                  <SignupForm />
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Sticky mini footer */}
      <footer className="mt-auto border-t bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-xs text-muted-foreground">
          <span>© Cortex AI</span>
          <span>نسخه ۱.۰</span>
        </div>
      </footer>
    </div>
  );
}
