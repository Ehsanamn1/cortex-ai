"use client";

import React, { type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { OperatorConsole } from "@/components/operator-console";

function ConsoleFallback({ message }: { message: string }) {
  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-7 text-center shadow-xl">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-600">
          <CircleAlert className="size-6" />
        </div>
        <h1 className="mt-4 text-lg font-black">بارگذاری پنل مدیریت ناموفق بود</h1>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">{message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-black text-primary-foreground"
          >
            بارگذاری مجدد
          </button>
          <a href="/admin/login" className="rounded-xl border border-border px-4 py-2 text-xs font-black">
            ورود مجدد
          </a>
        </div>
      </section>
    </main>
  );
}

class OperatorConsoleErrorBoundary extends React.Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Operator console failed to render", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <ConsoleFallback message={this.state.error.message || "خطای ناشناخته در پنل رخ داد."} />;
  }
}

export default function OperatorConsoleHost() {
  return (
    <OperatorConsoleErrorBoundary>
      <OperatorConsole />
    </OperatorConsoleErrorBoundary>
  );
}
