"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { api, ApiError } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { CortexMark } from "@/components/cortex/logo";
import { AuthScreen } from "@/components/cortex/auth-screen";
import { AppShell } from "@/components/cortex/app-shell";
import { Button } from "@/components/ui/button";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            const retryable = error.status === 0 || error.status >= 500 || error.status === 408;
            if (!retryable) return false;
          }
          return failureCount < 2;
        },
      },
    },
  });
}

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: [0.75, 1, 0.75], scale: [1, 1.06, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <CortexMark size={64} />
      </motion.div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-bold tracking-tight text-foreground">Cortex AI</span>
        <span className="text-xs text-muted-foreground">محصولی از ترانوس</span>
      </div>
    </div>
  );
}

function SessionGate() {
  const user = useCortexStore((s) => s.user);
  const hydrate = useCortexStore((s) => s.hydrate);
  const [phase, setPhase] = useState<"checking" | "signed-out" | "error">("checking");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void api
      .checkSession()
      .then((session) => {
        if (cancelled) return;
        if (session) hydrate(session.user, session.workspaces);
        else setPhase("signed-out");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // A stale/invalid session or a temporary session-check failure must not
        // brick the whole application. Let the user reach the auth screen.
        console.error("[cortex] session check failed:", error);
        setErrorMessage(error instanceof Error ? error.message : "خطای بررسی نشست");
        setPhase("signed-out");
      });
    return () => {
      cancelled = true;
    };
  }, [hydrate, attempts]);

  // Signing out (store user → null) must return to the auth screen even though
  // the initial session check already resolved. Store subscription keeps this
  // reactive without calling setState directly inside the effect body.
  useEffect(() => {
    const unsubscribe = useCortexStore.subscribe((state, prev) => {
      if (prev.user !== null && state.user === null) {
        setPhase("signed-out");
      }
    });
    return unsubscribe;
  }, []);

  if (user) return <AppShell />;

  if (phase === "checking") return <Splash />;

  if (phase === "signed-out") return <AuthScreen />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <CortexMark size={48} />
      <div className="space-y-2">
        <p className="font-semibold text-foreground">اتصال به Cortex AI برقرار نشد</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{errorMessage}</p>
      </div>
      <Button
        onClick={() => {
          setPhase("checking");
          setAttempts((a) => a + 1);
        }}
      >
        تلاش مجدد
      </Button>
    </div>
  );
}

export function CortexApp() {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionGate />
    </QueryClientProvider>
  );
}
