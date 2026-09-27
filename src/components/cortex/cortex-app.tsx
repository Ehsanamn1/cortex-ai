
"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { api, ApiError } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { CortexMark } from "@/components/cortex/logo";
import { AppShell } from "@/components/cortex/app-shell";
import { AuthScreen } from "@/components/cortex/auth-screen";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            const retryable = error.status === 0 || error.status >= 500 || error.status === 408 || error.status === 429;
            if (!retryable) return false;
          }
          return failureCount < 1;
        },
        retryDelay: () => 400,
      },
    },
  });
}

function Splash() {
  return (
    <div className="cortex-splash flex min-h-screen flex-col items-center justify-center gap-4 bg-background" aria-label="در حال بارگذاری Cortex">
      <div className="cortex-splash-mark">
        <CortexMark size={56} />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-bold tracking-tight text-foreground">Cortex AI</span>
        <span className="text-xs text-muted-foreground">محیط مدیریت ایجنت‌ها</span>
      </div>
    </div>
  );
}

function SessionGate() {
  const hydrate = useCortexStore((s) => s.hydrate);
  const [phase, setPhase] = useState<"checking" | "auth" | "ready">("checking");
  const [recoveryNotice, setRecoveryNotice] = useState("");

  useEffect(() => {
    const handleSessionExpired = () => {
      useCortexStore.getState().signOut();
      setPhase("auth");
    };
    window.addEventListener("cortex:session-expired", handleSessionExpired);
    return () => window.removeEventListener("cortex:session-expired", handleSessionExpired);
  }, []);

  const queryClient = useQueryClient();

  useEffect(() => {
    void queryClient.prefetchQuery({ queryKey: ["site-config"], queryFn: api.getSiteConfig, staleTime: 60_000 });
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      try {
        const session = await api.checkSession();
        if (cancelled) return;
        if (session) {
          hydrate(session.user, session.workspaces);
          setRecoveryNotice("");
          setPhase("ready");
          const preload = () => {
            void import("@/components/cortex/views/agents-view");
            void import("@/components/cortex/views/billing-view");
            void import("@/components/cortex/views/analytics-view");
            void import("@/components/cortex/views/conversations-view");
          };
          if ("requestIdleCallback" in window) window.requestIdleCallback(preload, { timeout: 1200 }); else window.setTimeout(preload, 80);
        } else {
          setPhase("auth");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "بازیابی جلسه Cortex ناموفق بود.";
        console.error("[cortex] session bootstrap failed:", error);
        try {
          await api.logout();
        } catch {
          // Best-effort cookie recovery.
        }
        if (cancelled) return;
        setRecoveryNotice(message);
        setPhase("auth");
      }
    }

    void bootstrapSession();

    return () => { cancelled = true; };
  }, [hydrate]);

  if (phase === "checking") return <Splash />;
  if (phase === "auth") return <AuthScreen onAuthenticated={() => setPhase("ready")} bootNotice={recoveryNotice} />;
  return <AppShell />;
}

export function CortexApp() {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <SessionGate />
    </QueryClientProvider>
  );
}
