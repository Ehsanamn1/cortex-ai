"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthScreen } from "@/components/cortex/auth-screen";
import { CortexThemeRuntime } from "@/components/cortex/theme-runtime";

export function StandaloneAuthPage({ defaultTab }: { defaultTab: "login" | "signup" }) {
  const router = useRouter();
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthScreen defaultTab={defaultTab} onAuthenticated={() => router.push("/")} />
    </QueryClientProvider>
  );
}
