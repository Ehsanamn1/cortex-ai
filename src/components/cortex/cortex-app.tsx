
"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
    <div className="cortex-splash flex min-h-screen flex-col items-center justify-center gap-5 bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: [0.75, 1, 0.75], scale: [1, 1.06, 1] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      >
        <CortexMark size={64} />
      </motion.div>
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
