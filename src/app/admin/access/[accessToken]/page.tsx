"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

export default function PrivateAdminAccessPage({ params }: { params: Promise<{ accessToken: string }> }) {
  const [message, setMessage] = useState("در حال باز کردن پیشخوان خصوصی…");

  useEffect(() => {
    let active = true;
    void params.then(async ({ accessToken }) => {
      try {
        window.history.replaceState(null, "", "/admin/access");
        const response = await fetch("/api/admin/auth/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token: accessToken }),
        });
        if (!response.ok) throw new Error("لینک مدیریتی معتبر نیست.");
        window.location.replace("/admin");
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "دسترسی مدیر برقرار نشد.");
      }
    });
    return () => { active = false; };
  }, [params]);

  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-[#0d100e] px-5 text-[#f2f0e8]">
      <section className="w-full max-w-md border border-[#30372b] bg-[#121610] p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center border border-[#b5d84b]/30 bg-[#b5d84b]/10 text-[#b5d84b]"><ShieldCheck className="size-5" /></span>
          <div><p className="text-[10px] font-semibold tracking-[0.24em] text-[#b5d84b]">PRIVATE CONSOLE</p><h1 className="mt-1 text-xl font-black">پیشخوان مدیریت Cortex</h1></div>
        </div>
        <div className="mt-7 flex items-center gap-3 border-t border-[#30372b] pt-5 text-sm text-[#afb5a7]"><Loader2 className="size-4 animate-spin" /><p>{message}</p></div>
        <p className="mt-5 text-[11px] leading-6 text-[#737c6f]">این لینک مخصوص مالک سیستم است و پس از تأیید، یک نشست HttpOnly می‌سازد.</p>
      </section>
    </main>
  );
}
