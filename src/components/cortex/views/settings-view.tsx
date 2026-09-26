"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleAlert,
  Database,
  Info,
  Loader2,
  LogOut,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { ErrorState, SignOutConfirm, StatusDot, useErrorToast, useSignOut } from "@/components/cortex/bits";
import { faNum, initialsOf } from "@/components/cortex/format";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

/* ---------------- provider status ---------------- */

function StatusBadge({ ok, readyLabel }: { ok: boolean; readyLabel: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-normal",
        ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"
      )}
    >
      {ok ? <CheckCircle2 aria-hidden="true" className="size-3" /> : <CircleAlert aria-hidden="true" className="size-3" />}
      {ok ? readyLabel : "پیکربندی نشده"}
    </Badge>
  );
}

function ProviderRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span dir="auto" className="truncate font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function ProvidersSection() {
  const workspaceId=useCortexStore((s)=>s.activeWorkspaceId);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["providers-status",workspaceId],
    queryFn: ()=>api.getProvidersStatus(workspaceId??undefined),
    staleTime: 5 * 60_000,
  });

  useErrorToast(isError ? error : null);

  if (isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "دریافت وضعیت زیرساخت ناموفق بود."}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader className="border-b [.border-b]:pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-lg border bg-secondary/10 text-secondary">
                <ShieldCheck className="size-4" />
              </span>
              جاسازی متن (Embedding)
            </CardTitle>
            <CardDescription>تبدیل دانش به بردار قابل جست‌وجو</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <StatusBadge ok={data.embeddings.status === "configured"} readyLabel="فعال" />
            <div className="space-y-2">
              <ProviderRow label="سرویس‌دهنده" value={data.embeddings.provider} />
              <ProviderRow
                label="روش"
                value={
                  data.embeddings.mode === "neural"
                    ? "عصبی"
                    : data.embeddings.mode === "lexical"
                      ? "واژگانی محلی (بدون شبکه عصبی)"
                      : "—"
                }
              />
            </div>
            {data.embeddings.mode === "lexical" && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                بازیابی دانش در حالت فعلی با موتور واژگانی محلی انجام می‌شود و برای آن کلید جداگانه لازم نیست.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="border-b [.border-b]:pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-lg border bg-emerald-500/10 text-emerald-400">
                <Database className="size-4" />
              </span>
              پایگاه داده برداری
            </CardTitle>
            <CardDescription>محل ذخیره و جست‌وجوی بردارهای دانش</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <StatusBadge ok={data.vectorStore.status === "ready"} readyLabel="آماده" />
            <div className="space-y-2">
              <ProviderRow
                label="نوع"
                value={data.vectorStore.provider === "qdrant" ? "Qdrant" : "محلی (PostgreSQL)"}
              />
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {data.vectorStore.provider === "qdrant"
                ? "بردارها در پایگاه داده برداری اختصاصی Qdrant ذخیره می‌شوند."
                : "بردارها روی همان PostgreSQL محصول ذخیره و با شباهت کسینوسی جستجو می‌شوند."}
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        اتصال مدل زبانی دیگر در این بخش انجام نمی‌شود؛ هر ایجنت از تب «هوش مصنوعی» اتصال اختصاصی خودش را مدیریت می‌کند.
      </p>
    </div>
  );
}


function LimitsSection(){
 const ws=useCortexStore(s=>s.activeWorkspaceId); const qc=useQueryClient(); const q=useQuery({queryKey:['limits',ws],queryFn:()=>api.getLimits(ws??undefined),enabled:!!ws}); const [dailyMessageLimit,setD]=useState(0);const [monthlyMessageLimit,setM]=useState(0);const [dailyTokenLimit,setDT]=useState(0);const [monthlyTokenLimit,setMT]=useState(0);
 // Form state intentionally mirrors the server-loaded policy once it arrives.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{const p=q.data?.policy;if(p){setD(p.dailyMessageLimit);setM(p.monthlyMessageLimit);setDT(p.dailyTokenLimit);setMT(p.monthlyTokenLimit)}},[q.data]);
 const save=useMutation({mutationFn:()=>api.saveLimits({workspaceId:ws??undefined,dailyMessageLimit,monthlyMessageLimit,dailyTokenLimit,monthlyTokenLimit}),onSuccess:()=>{qc.invalidateQueries({queryKey:['limits',ws]});toast.success('محدودیت‌ها ذخیره شد')},onError:e=>toast.error(e.message)});
 return <Card className="cortex-panel"><CardHeader><CardTitle className="text-base">سقف مصرف</CardTitle><CardDescription>عدد ۰ یعنی بدون سقف. این محدودیت‌ها برای وب و تلگرام مشترک هستند.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><LimitField label="پیام روزانه" value={dailyMessageLimit} setValue={setD}/><LimitField label="پیام ماهانه" value={monthlyMessageLimit} setValue={setM}/><LimitField label="توکن روزانه" value={dailyTokenLimit} setValue={setDT}/><LimitField label="توکن ماهانه" value={monthlyTokenLimit} setValue={setMT}/><div className="sm:col-span-2 flex justify-end"><Button variant="outline" disabled={save.isPending} onClick={()=>save.mutate()}>{save.isPending?'در حال ذخیره…':'ذخیره محدودیت‌ها'}</Button></div></CardContent></Card>
}
function LimitField({label,value,setValue}:{label:string;value:number;setValue:(v:number)=>void}){return <div><Label>{label}</Label><Input type="number" min={0} className="mt-2" value={value} onChange={e=>setValue(Math.max(0,Number(e.target.value)||0))}/></div>}

/* ---------------- account ---------------- */

function AccountSection() {
  const user = useCortexStore((s) => s.user);
  const signOutNow = useSignOut();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Card className="rounded-xl">
      <CardHeader className="border-b [.border-b]:pb-4">
        <CardTitle className="text-base">حساب کاربری</CardTitle>
        <CardDescription>اطلاعات حساب شما در Cortex AI</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start justify-between gap-4 pt-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-11 border">
            <AvatarFallback className="bg-primary/15 text-sm font-bold text-primary">
              {initialsOf(user?.name, "C")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{user?.name ?? "کاربر"}</p>
            <p dir="ltr" className="truncate text-left text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </div>
        <Button variant="outline" className="shrink-0 text-destructive hover:text-destructive" onClick={() => setConfirmOpen(true)}>
          <LogOut />
          خروج از حساب
        </Button>
      </CardContent>
      <SignOutConfirm open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={() => void signOutNow()} />
    </Card>
  );
}

/* ---------------- workspaces ---------------- */

function WorkspaceSection() {
  const workspaces = useCortexStore((s) => s.workspaces);
  const activeWorkspaceId = useCortexStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useCortexStore((s) => s.setActiveWorkspace);
  const setWorkspaces = useCortexStore((s) => s.setWorkspaces);
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (workspaceName: string) => api.createWorkspace(workspaceName),
    onSuccess: ({ workspace }) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setWorkspaces([...workspaces, workspace]);
      setActiveWorkspace(workspace.id);
      setCreateOpen(false);
      setName("");
      setNameError(null);
      toast.success(`فضای کاری «${workspace.name}» ساخته شد`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError("نام فضای کاری باید حداقل ۲ کاراکتر باشد.");
      return;
    }
    setNameError(null);
    createMutation.mutate(trimmed);
  }

  return (
    <Card className="rounded-xl">
      <CardHeader className="border-b [.border-b]:pb-4">
        <CardTitle className="text-base">فضای کاری</CardTitle>
        <CardDescription>فضاهای کاری که عضو آن‌ها هستید</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {workspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">هنوز فضای کاری وجود ندارد.</p>
        ) : (
          <ul className="space-y-2">
            {workspaces.map((workspace) => {
              const active = workspace.id === activeWorkspaceId;
              return (
                <li
                  key={workspace.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5",
                    active ? "border-primary/40 bg-primary/5" : "bg-transparent"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {active && <StatusDot className="bg-primary" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{workspace.name}</p>
                      <p className="text-xs text-muted-foreground">
                        نقش شما: {workspace.role === "owner" ? "مالک" : workspace.role === "admin" ? "مدیر" : workspace.role}
                        {workspace._count ? ` · ${faNum(workspace._count.agents)} ایجنت` : ""}
                      </p>
                    </div>
                  </div>
                  {active ? (
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 font-normal text-primary">
                      فعال
                    </Badge>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setActiveWorkspace(workspace.id)}>
                      انتخاب
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="pt-1">
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus />
            ایجاد فضای کاری جدید
          </Button>
        </div>
      </CardContent>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setName(""); setNameError(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>ایجاد فضای کاری جدید</DialogTitle>
            <DialogDescription>فضای کاری برای جداسازی ایجنت‌ها و دانش سازمان‌های مختلف استفاده می‌شود.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="workspace-name">نام فضای کاری</Label>
            <Input
              id="workspace-name"
              placeholder="مثلاً تیم فروش"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "workspace-name-error" : undefined}
            />
            {nameError && (
              <p id="workspace-name-error" className="text-xs text-destructive">
                {nameError}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
              انصراف
            </Button>
            <Button onClick={submit} disabled={!name.trim() || createMutation.isPending}>
              {createMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
              {createMutation.isPending ? "در حال ساخت..." : "ایجاد فضای کاری"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------- view ---------------- */

export function SettingsView() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">تنظیمات</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          وضعیت سرویس‌ها، حساب کاربری و فضاهای کاری خود را مدیریت کنید.
        </p>
      </div>

      <section aria-labelledby="settings-providers" className="space-y-4">
        <h3 id="settings-providers" className="text-base font-semibold text-foreground">
          وضعیت زیرساخت هوش مصنوعی
        </h3>
        <ProvidersSection />
      </section>

      <section aria-labelledby="settings-limits" className="space-y-4"><h3 id="settings-limits" className="text-base font-semibold text-foreground">کنترل مصرف</h3><LimitsSection /></section>

      <section aria-labelledby="settings-account" className="space-y-4">
        <h3 id="settings-account" className="text-base font-semibold text-foreground">
          حساب کاربری
        </h3>
        <AccountSection />
      </section>

      <section aria-labelledby="settings-workspace" className="space-y-4">
        <h3 id="settings-workspace" className="text-base font-semibold text-foreground">
          فضای کاری
        </h3>
        <WorkspaceSection />
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-dashed bg-card/40 p-4">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Cortex AI شامل لایه دانش و RAG، اتصال Telegram، مدیریت مصرف، تحلیل و کنترل عملیاتی است. قابلیت‌های پیشرفته‌تر محصول می‌توانند در نسخه‌های بعدی بدون شکستن این هسته اضافه شوند.
        </p>
      </div>
    </div>
  );
}
