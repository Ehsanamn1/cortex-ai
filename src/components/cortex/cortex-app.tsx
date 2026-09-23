
"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { api, ApiError } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { CortexMark } from "@/components/cortex/logo";
import { AppShell } from "@/components/cortex/app-shell";
import { AuthScreen } from "@/components/cortex/auth-screen";
import { Button } from "@/components/ui/button";
import { CortexThemeRuntime } from "@/components/cortex/theme-runtime";

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
        <span className="text-xs text-muted-foreground">محیط مدیریت ایجنت‌ها</span>
      </div>
    </div>
  );
}

function SessionGate() {
  const hydrate = useCortexStore((s) => s.hydrate);
  const [phase, setPhase] = useState<"checking" | "auth" | "ready" | "error">("checking");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      try {
        const session = await api.checkSession();
        if (cancelled) return;
        if (session) {
          hydrate(session.user, session.workspaces);
          setPhase("ready");
        } else {
          setPhase("auth");
        }
      } catch (error) {
        if (cancelled) return;
        console.error("[cortex] session bootstrap failed:", error);
        setErrorMessage(error instanceof Error ? error.message : "راه‌اندازی Cortex ناموفق بود.");
        setPhase("error");
      }
    }

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  if (phase === "checking") return <Splash />;

  if (phase === "auth") return <AuthScreen onAuthenticated={() => setPhase("ready")} />;

  if (phase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <CortexMark size={48} />
        <div className="space-y-2">
          <p className="font-semibold text-foreground">راه‌اندازی Cortex انجام نشد</p>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{errorMessage}</p>
        </div>
        <Button onClick={() => window.location.reload()}>تلاش مجدد</Button>
      </div>
    );
  }

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
