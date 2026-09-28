"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/cortex-client";
import { AuthScreen } from "@/components/cortex/auth-screen";

export function AuthRoute({ defaultTab }: { defaultTab: "login" | "signup" }) {
  const router = useRouter();
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 } },
  }));

  useEffect(() => {
    void api.checkSession().then((session) => {
      if (session) router.replace("/app");
    }).catch(() => undefined);
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthScreen defaultTab={defaultTab} onAuthenticated={() => router.replace("/")} />
    </QueryClientProvider>
  );
}
