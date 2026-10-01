"use client";

import dynamic from "next/dynamic";

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

export default function OperatorConsoleHost() {
  return <OperatorConsole />;
}
