"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

export function AdminAccessClient({ token }: { token: string }) {
  const [message, setMessage] = useState(token ? "در حال باز کردن پیشخوان خصوصی…" : "توکن دسترسی مدیر در این لینک وجود ندارد.");

  useEffect(() => {
    if (!token) return;
    let active = true;
    void fetch("/api/admin/auth/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error || "لینک مدیریتی معتبر نیست.");
        }
        window.history.replaceState(null, "", "/admin");
        window.location.replace("/admin");
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "دسترسی مدیر برقرار نشد.");
      });
    return () => { active = false; };
  }, [token]);

  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
      <section className="w-full max-w-md rounded-xl border border-border bg-card p-7 shadow-none">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center border border-primary/20 bg-primary/10 text-primary"><ShieldCheck className="size-5" /></span>
          <div><p className="text-[10px] font-semibold tracking-[0.18em] text-primary">PRIVATE CONSOLE</p><h1 className="mt-1 text-xl font-black">پیشخوان مدیریت Cortex</h1></div>
        </div>
        <div className="mt-7 flex items-center gap-3 border-t border-border/60 pt-5 text-sm text-muted-foreground">
          {token ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4 text-primary" />}
          <p>{message}</p>
        </div>
        <p className="mt-5 text-[11px] leading-6 text-muted-foreground">
          لینک مدیر مستقل از دستگاه است. با هر دستگاهی که همین لینک خصوصی را باز کنی، پس از اعتبارسنجی یک نشست HttpOnly همان دستگاه ساخته می‌شود.
        </p>
      </section>
    </main>
  );
}
