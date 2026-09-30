"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";

export function AdminLoginClient() {
  const [username, setUsername] = useState("ehsanam86");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/admin/auth/me", { credentials: "include", cache: "no-store" })
      .then((response) => {
        if (response.ok) window.location.replace("/admin");
      })
      .catch(() => {});
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ username }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "ورود به پنل مدیریت انجام نشد.");
      window.location.replace("/admin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ورود ناموفق بود.");
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
      <section className="w-full max-w-sm border border-border bg-card p-7 shadow-none">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center border border-primary/20 bg-primary/10 text-primary">
            <LockKeyhole className="size-5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] text-primary">CORTEX ADMIN</p>
            <h1 className="mt-1 text-xl font-black">ورود به پیشخوان بک‌اند</h1>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-muted-foreground">نام کاربری</span>
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-12 w-full border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
              placeholder="ehsanam86"
              spellCheck={false}
            />
          </label>

          {message ? <p className="text-sm text-destructive">{message}</p> : null}

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="flex h-12 w-full items-center justify-center gap-2 bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            ورود به پنل
          </button>
        </form>

        <p className="mt-5 text-[11px] leading-6 text-muted-foreground">
          این ورود فقط نام کاربری مدیریت را می‌گیرد؛ رمز عبور و لینک Secret برای ورود لازم نیست. وضعیت ورود به‌صورت امن در مرورگر نگه‌داری می‌شود تا درخواست‌های پنل محافظت شوند.
        </p>
      </section>
    </main>
  );
}
