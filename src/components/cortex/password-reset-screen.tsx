"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/cortex-client";
import { CortexLogo } from "@/components/cortex/logo";
import { ThemeToggle } from "@/components/cortex/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordResetScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) {
      toast.error("لینک بازنشانی رمز معتبر نیست.");
      return;
    }
    if (password.length < 8) {
      toast.error("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    if (password !== repeat) {
      toast.error("رمزهای عبور یکسان نیستند.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.resetPassword(token, password);
      setDone(true);
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تغییر رمز عبور ناموفق بود.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-6 flex items-center justify-between">
          <CortexLogo markSize={42} />
          <ThemeToggle />
        </div>

        <section className="cortex-auth-card rounded-[30px] border border-border/70 bg-card/85 p-5 shadow-[0_28px_90px_rgba(0,0,0,.22)] backdrop-blur-2xl sm:p-8">
          {!token ? (
            <div className="text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-destructive/15 bg-destructive/10 text-destructive"><KeyRound /></span>
              <h1 className="mt-5 text-2xl font-black">لینک بازنشانی نامعتبر است</h1>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">برای دریافت لینک جدید، به صفحه ورود برگردید و «فراموشی رمز عبور» را انتخاب کنید.</p>
              <Button className="mt-6 w-full" onClick={() => router.push("/login")}>بازگشت به ورود</Button>
            </div>
          ) : done ? (
            <div className="text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400"><ShieldCheck /></span>
              <h1 className="mt-5 text-2xl font-black">رمز عبور تغییر کرد</h1>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">رمز جدیدت فعال شده است. حالا با رمز جدید وارد Cortex شو.</p>
              <Button className="mt-6 w-full" onClick={() => router.push("/login")}>ورود به Cortex</Button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-primary/15 bg-primary/10 text-primary"><KeyRound /></span>
                <p className="mt-5 cortex-kicker">SECURE RESET</p>
                <h1 className="mt-2 text-2xl font-black">رمز عبور جدیدت را تنظیم کن</h1>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">این لینک محدود و یک‌بارمصرف است. یک رمز عبور قوی انتخاب کن.</p>
              </div>

              <form onSubmit={submit} className="mt-7 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-password">رمز عبور جدید</Label>
                  <div className="relative">
                    <Input id="reset-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="pe-11" placeholder="حداقل ۸ کاراکتر" />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute start-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? "پنهان کردن رمز" : "نمایش رمز"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-password-repeat">تکرار رمز عبور</Label>
                  <div className="relative">
                    <Input id="reset-password-repeat" type={showRepeat ? "text" : "password"} value={repeat} onChange={(event) => setRepeat(event.target.value)} autoComplete="new-password" className="pe-11" placeholder="رمز را دوباره وارد کن" />
                    <button type="button" onClick={() => setShowRepeat((value) => !value)} className="absolute start-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showRepeat ? "پنهان کردن رمز" : "نمایش رمز"}>{showRepeat ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                  </div>
                </div>

                <div className="rounded-2xl border border-primary/10 bg-primary/[.035] p-3 text-[10px] leading-6 text-muted-foreground">
                  حداقل ۸ کاراکتر استفاده کن و رمز جدیدت را با دیگران به اشتراک نگذار.
                </div>

                <Button type="submit" className="cortex-auth-submit w-full" disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin" />}
                  {submitting ? "در حال ذخیره رمز جدید…" : "ذخیره رمز عبور جدید"}
                </Button>
                <button type="button" onClick={() => router.push("/login")} className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground">بازگشت به ورود</button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
