"use client";

import dynamic from "next/dynamic";
import React from "react";
import { useEffect, useState, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";

const OperatorConsole = dynamic(
  () => import("@/components/operator-console").then((module) => module.OperatorConsole),
  {
    ssr: false,
    loading: () => (
      <main dir="rtl" className="min-h-screen bg-background px-5 py-8 text-foreground">
        <div className="mx-auto max-w-7xl animate-pulse rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="h-8 w-52 rounded-lg bg-muted" />
          <div className="mt-4 h-4 w-96 max-w-full rounded bg-muted" />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-muted" />)}
          </div>
        </div>
      </main>
    ),
  },
);

class OperatorConsoleErrorBoundary extends React.Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Operator console failed to load", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main dir="rtl" className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
        <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-7 text-center shadow-xl">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-600">
            <CircleAlert className="size-6" />
          </div>
          <h1 className="mt-4 text-lg font-black">بارگذاری پنل مدیریت ناموفق بود</h1>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            {this.state.error.message || "خطای ناشناخته در بارگذاری پنل رخ داد."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-black text-primary-foreground"
            >
              بارگذاری مجدد
            </button>
            <a
              href="/admin/login"
              className="rounded-xl border border-border px-4 py-2 text-xs font-black"
            >
              ورود مجدد
            </a>
          </div>
        </section>
      </main>
    );
  }
}

export default function OperatorConsoleHost() {
  return (
    <OperatorConsoleErrorBoundary>
      <OperatorConsole />
    </OperatorConsoleErrorBoundary>
  );
}
