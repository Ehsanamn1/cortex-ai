"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  FileText,
  FileUp,
  Globe,
  Library,
  Loader2,
  RotateCw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  type KnowledgeSourceDto,
  type KnowledgeSourceStatus,
} from "@/lib/cortex-client";
import { EmptyState, ErrorState, KnowledgeStatusBadge, useErrorToast } from "@/components/cortex/bits";
import { faNum, formatDateFa, formatSizeFa } from "@/components/cortex/format";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/* ---------------- hooks ---------------- */

/** Knowledge query with live polling while any source is pending/processing. */
export function useAgentKnowledge(agentId: string) {
  return useQuery({
    queryKey: ["knowledge", agentId],
    queryFn: () => api.getKnowledge(agentId),
    refetchInterval: (query) => {
      const sources = query.state.data?.sources;
      return sources?.some((s) => s.status === "pending" || s.status === "processing") ? 2500 : false;
    },
  });
}

/** Toasts when a source transitions to ready / failed between polls. */
export function useSourceTransitionToasts(sources: KnowledgeSourceDto[] | undefined) {
  const previous = useRef(new Map<string, KnowledgeSourceStatus>());

  useEffect(() => {
    if (!sources) return;
    for (const source of sources) {
      const prev = previous.current.get(source.id);
      if (prev && prev !== source.status) {
        if (source.status === "ready") {
          toast.success(`دانش «${source.name}» آماده شد`);
        } else if (source.status === "failed") {
          toast.error(`پردازش «${source.name}» ناموفق بود`);
        }
      }
      previous.current.set(source.id, source.status);
    }
  }, [sources]);
}

/* ---------------- add-source dialogs ---------------- */

export function AddFileDialog({
  agentId,
  open,
  onOpenChange,
}: {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Inner component unmounts with the dialog → local state resets automatically. */}
      <AddFileDialogInner agentId={agentId} onOpenChange={onOpenChange} />
    </Dialog>
  );
}

function AddFileDialogInner({
  agentId,
  onOpenChange,
}: {
  agentId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (selected: File) => {
      setProgress(8);
      const result = await api.uploadKnowledgeFile(agentId, selected);
      setProgress(100);
      return result;
    },
    onSuccess: () => {
      invalidateKnowledge(queryClient, agentId);
      setProgress(100);
      onOpenChange(false);
      toast.success("فایل دریافت شد؛ پردازش دانش در حال انجام است.");
    },
    onError: (mutationError: Error) => {
      setProgress(0);
      toast.error(mutationError.message || "بارگذاری فایل ناموفق بود.");
    },
  });

  function pickFile(candidate: File | null | undefined) {
    if (!candidate) return;
    if (candidate.size > MAX_FILE_SIZE) {
      setError("حجم فایل نباید بیشتر از ۲۰ مگابایت باشد.");
      setFile(null);
      return;
    }
    setError(null);
    setFile(candidate);
  }

  return (
    <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle>افزودن فایل به دانش</DialogTitle>
          <DialogDescription>هر فایل تا ۲۰ مگابایت قابل دریافت است و بعد از بارگذاری به‌صورت امن پردازش و ایندکس می‌شود.</DialogDescription>
        </DialogHeader>

        <div
          role="button"
          tabIndex={0}
          aria-label="ناحیه انتخاب یا رها کردن فایل"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            pickFile(event.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent/50"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,.docx,.md,.csv,.json,.xml,.html,.htm,.yaml,.yml,.log,.tsv,.sql"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              pickFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {file ? (
            <div className="flex w-full max-w-sm items-center gap-3 rounded-lg border bg-card p-3 text-start">
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatSizeFa(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="حذف فایل انتخاب‌شده"
                onClick={(event) => {
                  event.stopPropagation();
                  setFile(null);
                }}
              >
                <X />
              </Button>
            </div>
          ) : (
            <>
              <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-xl border bg-card text-primary">
                <UploadCloud className="size-5" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">فایل را این‌جا رها کنید</p>
                <p className="text-xs text-muted-foreground">یا برای انتخاب از دستگاه کلیک کنید · PDF، DOCX، TXT، MD، CSV، JSON، XML، HTML و داده‌های متنی</p>
              </div>
            </>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {uploadMutation.isPending && (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>بارگذاری امن فایل…</span>
              <span>{faNum(progress)}٪</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: progress + "%" }} />
            </div>
            <p className="text-[10px] text-muted-foreground">فایل‌های بزرگ مستقیماً به Storage ارسال می‌شوند.</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploadMutation.isPending}>
            انصراف
          </Button>
          <Button disabled={!file || !!error || uploadMutation.isPending} onClick={() => file && uploadMutation.mutate(file)}>
            {uploadMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
            {uploadMutation.isPending ? "در حال بارگذاری..." : "افزودن فایل"}
          </Button>
        </DialogFooter>
    </DialogContent>
  );
}

export function AddUrlDialog({
  agentId,
  open,
  onOpenChange,
}: {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Inner component unmounts with the dialog → local state resets automatically. */}
      <AddUrlDialogInner agentId={agentId} onOpenChange={onOpenChange} />
    </Dialog>
  );
}

function AddUrlDialogInner({
  agentId,
  onOpenChange,
}: {
  agentId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: (value: string) => api.addKnowledgeUrl(agentId, value),
    onSuccess: () => {
      invalidateKnowledge(queryClient, agentId);
      onOpenChange(false);
      toast.success("در حال پردازش دانش...");
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  function submit() {
    const trimmed = url.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      setError("آدرس وب معتبر نیست.");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      setError("آدرس باید با http یا https شروع شود.");
      return;
    }
    setError(null);
    addMutation.mutate(trimmed);
  }

  return (
    <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle>افزودن وب‌سایت</DialogTitle>
          <DialogDescription>آدرس صفحه‌ای که می‌خواهید به دانش ایجنت اضافه شود را وارد کنید.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="knowledge-url">آدرس وب‌سایت</Label>
          <Input
            id="knowledge-url"
            dir="ltr"
            placeholder="https://example.com/about"
            className="text-left"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            aria-invalid={!!error}
            aria-describedby={error ? "knowledge-url-error" : undefined}
          />
          {error && (
            <p id="knowledge-url-error" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={addMutation.isPending}>
            انصراف
          </Button>
          <Button onClick={submit} disabled={!url.trim() || addMutation.isPending}>
            {addMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
            {addMutation.isPending ? "در حال افزودن..." : "افزودن وب‌سایت"}
          </Button>
        </DialogFooter>
    </DialogContent>
  );
}

/* ---------------- invalidation helper ---------------- */

export function invalidateKnowledge(queryClient: ReturnType<typeof useQueryClient>, agentId?: string) {
  if (agentId) {
    queryClient.invalidateQueries({ queryKey: ["knowledge", agentId] });
    queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
  }
  queryClient.invalidateQueries({ queryKey: ["knowledge-all"] });
  queryClient.invalidateQueries({ queryKey: ["agents"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

/* ---------------- source card ---------------- */

function SourceCard({ source }: { source: KnowledgeSourceDto }) {
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const retryMutation = useMutation({
    mutationFn: () => api.retryKnowledgeSource(source.id),
    onSuccess: () => {
      invalidateKnowledge(queryClient);
      toast.success("پردازش مجدد آغاز شد");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteKnowledgeSource(source.id),
    onSuccess: () => {
      invalidateKnowledge(queryClient);
      toast.success("منبع دانش حذف شد");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const isFile = source.type === "file";
  const busy = source.status === "pending" || source.status === "processing";

  return (
    <Card className="gap-0 rounded-xl py-0">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg border",
              isFile ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
            )}
          >
            {isFile ? <FileText className="size-[18px]" /> : <Globe className="size-[18px]" />}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground" title={source.name}>
              {source.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {isFile ? "فایل" : "وب‌سایت"} · {faNum(source.chunkCount)} بخش · {formatDateFa(source.createdAt)}
            </p>
          </div>

          <KnowledgeStatusBadge status={source.status} />

          <div className="flex items-center gap-1">
            {source.status === "failed" && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="پردازش مجدد منبع"
                title="پردازش مجدد"
                disabled={retryMutation.isPending}
                onClick={() => retryMutation.mutate()}
              >
                {retryMutation.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="حذف منبع دانش"
              title="حذف منبع"
              className="text-muted-foreground hover:text-destructive"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteOpen(true)}
            >
              {deleteMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            </Button>
          </div>
        </div>

        {source.status === "failed" && source.error && (
          <Alert variant="destructive" className="mt-3">
            <AlertCircle />
            <AlertDescription className="text-xs leading-relaxed">{source.error}</AlertDescription>
          </Alert>
        )}
        {busy && (
          <p className="mt-2.5 border-t pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
            متن این منبع در حال تبدیل به بردارهای معنایی است؛ تا «آماده» شدن، در پاسخ‌ها استفاده نمی‌شود.
          </p>
        )}
      </CardContent>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف منبع دانش</AlertDialogTitle>
            <AlertDialogDescription>
              این عمل غیرقابل بازگشت است. حذف منبع، بخش‌ها و بردارهای مرتبط را نیز حذف می‌کند.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                setDeleteOpen(false);
                deleteMutation.mutate();
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function SourcesList({ sources }: { sources: KnowledgeSourceDto[] }) {
  return (
    <ul className="space-y-3">
      {sources.map((source) => (
        <li key={source.id}>
          <SourceCard source={source} />
        </li>
      ))}
    </ul>
  );
}

/* ---------------- knowledge manager (agent-scoped) ---------------- */

export function KnowledgeManager({ agentId }: { agentId: string }) {
  const [fileOpen, setFileOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);

  const { data, isPending, isError, error, refetch } = useAgentKnowledge(agentId);
  useSourceTransitionToasts(data?.sources);
  useErrorToast(isError ? error : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setFileOpen(true)}>
          <FileUp />
          افزودن فایل
        </Button>
        <Button variant="outline" onClick={() => setUrlOpen(true)}>
          <Globe />
          افزودن وب‌سایت
        </Button>
      </div>

      <AddFileDialog agentId={agentId} open={fileOpen} onOpenChange={setFileOpen} />
      <AddUrlDialog agentId={agentId} open={urlOpen} onOpenChange={setUrlOpen} />

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={error instanceof Error ? error.message : "دریافت منابع دانش ناموفق بود."} onRetry={() => void refetch()} />
      ) : !data || data.sources.length === 0 ? (
        <EmptyState
          icon={
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl border bg-muted text-primary">
              <Library className="size-7" />
            </span>
          }
          title="هنوز منبع دانشی اضافه نشده است"
          description="فایل یا آدرس وب‌سایت اضافه کنید تا ایجنت از آن برای پاسخ‌دهی استفاده کند."
          className="bg-card"
        />
      ) : (
        <SourcesList sources={data.sources} />
      )}
    </div>
  );
}
