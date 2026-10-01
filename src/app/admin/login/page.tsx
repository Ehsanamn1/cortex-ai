"use client";

import { FormEvent, useState } from "react";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("ehsanam86");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json().catch(() => ({})) as {
        error?: string;
        message?: string;
        data?: { dashboardPath?: string };
        dashboardPath?: string;
      };
      if (!response.ok) {
        throw new Error(body?.error || body?.message || "ورود به پنل مدیریت انجام نشد.");
      }
      const dashboardPath = body.data?.dashboardPath ?? body.dashboardPath;
      if (!dashboardPath) throw new Error("مسیر خصوصی پنل تولید نشد.");
      window.location.assign(dashboardPath);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ورود ناموفق بود.");
      setBusy(false);
    }
  }

  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl shadow-black/5">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <ShieldCheck className="size-6" />
          </span>
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-primary">CORTEX PRIVATE ACCESS</p>
            <h1 className="mt-1 text-xl font-black">ورود به پنل مدیریت</h1>
          </div>
        </div>

        <p className="mt-6 text-sm leading-7 text-muted-foreground">
          این مسیر فقط برای مدیر محصول است. پس از ورود، یک نشست HttpOnly امن روی همین دستگاه ساخته می‌شود.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold">نام کاربری</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              spellCheck={false}
              dir="ltr"
              className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold">رمز عبور</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              dir="ltr"
              className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-xs leading-6 text-rose-600">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || !username.trim() || !password}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
            {busy ? "در حال ورود…" : "ورود امن به پنل"}
          </button>
        </form>

        <p className="mt-5 text-center text-[10px] leading-5 text-muted-foreground">
          آدرس اصلی <span dir="ltr">/admin</span> عمداً عمومی نیست؛ ورود از همین مسیر خصوصی انجام می‌شود.
        </p>
      </section>
    </main>
  );
}
