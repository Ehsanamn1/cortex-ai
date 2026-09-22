"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock3, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, ApiError, type KnowledgeSourceStatus } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { cn } from "@/lib/utils";

/* ---------------- status dot ---------------- */

export function StatusDot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 rounded-full", className)} />;
}

/* ---------------- inline error with retry ---------------- */

export function ErrorState({
  message,
  onRetry,
  title = "مشکلی پیش آمد",
  className,
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span className="leading-relaxed">{message}</span>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            تلاش مجدد
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** Fire an error toast whenever an error object changes to a truthy value. */
export function useErrorToast(error: unknown) {
  useEffect(() => {
    if (!error) return;
    const message =
      error instanceof ApiError || error instanceof Error
        ? error.message
        : "خطای غیرمنتظره‌ای رخ داد.";
    toast.error(message);
  }, [error]);
}

/* ---------------- empty state ---------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-card/40 px-6 py-14 text-center",
        className
      )}
    >
      {icon}
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------------- knowledge source status badge ---------------- */

const KNOWLEDGE_STATUS: Record<KnowledgeSourceStatus, { label: string; className: string }> = {
  pending: { label: "در انتظار", className: "border-border bg-muted text-muted-foreground" },
  processing: { label: "در حال پردازش", className: "border-primary/30 bg-primary/10 text-primary" },
  ready: { label: "آماده", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  failed: { label: "ناموفق", className: "border-destructive/30 bg-destructive/10 text-destructive" },
};

export function KnowledgeStatusBadge({ status, className }: { status: KnowledgeSourceStatus; className?: string }) {
  const config = KNOWLEDGE_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {status === "processing" ? (
        <Loader2 aria-hidden="true" className="size-3 animate-spin" />
      ) : status === "ready" ? (
        <CheckCircle2 aria-hidden="true" className="size-3" />
      ) : status === "failed" ? (
        <AlertCircle aria-hidden="true" className="size-3" />
      ) : (
        <Clock3 aria-hidden="true" className="size-3" />
      )}
      {config.label}
    </span>
  );
}

/* ---------------- sign out ---------------- */

/** Performs logout: API call, store reset and cache clear. UI confirm handled by the caller. */
export function useSignOut() {
  const signOut = useCortexStore((s) => s.signOut);
  const queryClient = useQueryClient();

  return async function signOutNow(): Promise<void> {
    try {
      await api.logout();
    } catch {
      // Even if the call fails locally, clearing the session client-side is the safe path.
      toast.error("خروج از حساب با خطا مواجه شد؛ نشست محلی پاک شد.");
    }
    signOut();
    queryClient.clear();
  };
}

/** Shared sign-out confirmation dialog. */
export function SignOutConfirm({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>خروج از حساب کاربری</AlertDialogTitle>
          <AlertDialogDescription>
            آیا از خروج اطمینان دارید؟ برای بازگشت، باید دوباره وارد حساب خود شوید.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>انصراف</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            خروج
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
