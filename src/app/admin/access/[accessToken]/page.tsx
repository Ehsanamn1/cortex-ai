"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

export default function PrivateAdminAccessPage({ params }: { params: Promise<{ accessToken: string }> }) {
  const [message, setMessage] = useState("در حال باز کردن پیشخوان خصوصی…");

  useEffect(() => {
    let active = true;
    void params.then(async ({ accessToken }) => {
      try {
        const response = await fetch("/api/admin/auth/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token: accessToken }),
        });
        if (!response.ok) throw new Error("لینک مدیریتی معتبر نیست.");
        window.history.replaceState(null, "", "/admin");
        window.location.replace("/admin");
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "دسترسی مدیر برقرار نشد.");
      }
    });
    return () => { active = false; };
  }, [params]);

  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
      <section className="w-full max-w-md rounded-xl border border-border bg-card p-7 shadow-none">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center border border-primary/20 bg-primary/10 text-primary"><ShieldCheck className="size-5" /></span>
          <div><p className="text-[10px] font-semibold tracking-[0.18em] text-primary">PRIVATE CONSOLE</p><h1 className="mt-1 text-xl font-black">پیشخوان مدیریت Cortex</h1></div>
        </div>
        <div className="mt-7 flex items-center gap-3 border-t border-border/60 pt-5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /><p>{message}</p></div>
        <p className="mt-5 text-[11px] leading-6 text-muted-foreground">این لینک مخصوص مالک سیستم است و پس از تأیید، یک نشست HttpOnly می‌سازد.</p>
      </section>
    </main>
  );
}
