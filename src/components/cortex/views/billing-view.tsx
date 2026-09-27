"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  ArrowUpLeft,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  Info,
  Layers3,
  Plus,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { api } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { faNum } from "@/components/cortex/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const config = status === "approved"
    ? { label: "تأیید شده", className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300", icon: CheckCircle2 }
    : status === "rejected"
      ? { label: "رد شده", className: "border-rose-400/25 bg-rose-400/10 text-rose-300", icon: Info }
      : { label: "در انتظار بررسی", className: "border-amber-400/25 bg-amber-400/10 text-amber-300", icon: Clock3 };
  const Icon = config.icon;
  return <Badge variant="outline" className={cn("gap-1.5", config.className)}><Icon className="size-3.5" />{config.label}</Badge>;
}

function MetricCard({ icon: Icon, title, value, caption }: { icon: typeof Activity; title: string; value: string; caption: string }) {
  return (
    <Card className="cortex-panel rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="cortex-icon-box"><Icon className="size-[18px]" /></span>
          <span className="text-[10px] text-muted-foreground">{caption}</span>
        </div>
        <p className="mt-5 text-2xl font-black tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{title}</p>
      </CardContent>
    </Card>
  );
}

export function BillingView() {
  const workspaceId = useCortexStore((s) => s.activeWorkspaceId);
  const queryClient = useQueryClient();

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["billing", workspaceId],
    queryFn: () => api.getBilling(workspaceId ?? undefined),
    enabled: !!workspaceId,
    staleTime: 20_000,
  });

  const topUp = useMutation({
    mutationFn: (packageKey: string) => api.requestBillingTopUp(packageKey, workspaceId ?? undefined),
    onSuccess: () => {
      toast.success("درخواست شارژ ثبت شد و برای بررسی مدیریت ارسال شد.");
      queryClient.invalidateQueries({ queryKey: ["billing", workspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const byProvider = useMemo(() => {
    if (!data) return [] as Array<[string, number]>;
    const map = new Map<string, number>();
    for (const model of data.models) map.set(model.provider, (map.get(model.provider) ?? 0) + 1);
    return [...map.entries()];
  }, [data]);

  if (!workspaceId) {
    return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">فضای کاری فعالی انتخاب نشده است.</CardContent></Card>;
  }
  if (isPending) {
    return <div className="space-y-5"><div className="h-64 animate-pulse rounded-[30px] bg-muted" /><div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-muted" />)}</div></div>;
  }
  if (isError || !data) {
    return <Card className="border-destructive/30"><CardContent className="p-7"><p className="font-semibold">صورتحساب در دسترس نیست.</p><p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : "خطا در دریافت اطلاعات تجاری"}</p></CardContent></Card>;
  }

  const plan = data.account.plan;
  const shadow = !data.account.enforcementEnabled;
  const monthly = Math.max(plan.monthlyCredits, 1);
  const balanceProgress = Math.min(100, Math.round((Math.max(data.account.balanceCredits, 0) / monthly) * 100));
  const pendingRequests = data.topUpRequests.filter((x) => x.status === "pending").length;

  return (
    <div className="space-y-7">
      <section className="cortex-wallet-card relative rounded-[32px] p-5 sm:p-7 lg:p-8">
        <div className="relative z-10 grid items-center gap-6 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="cortex-kicker">CORTEX WALLET</span>
              <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">{plan.name}</Badge>
              {shadow && <Badge variant="outline" className="border-amber-400/20 bg-amber-400/10 text-amber-300">آزمایشی</Badge>}
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">اعتبار، مصرف و شارژ</h2>
            <p className="mt-3 max-w-2xl text-sm leading-8 text-muted-foreground">کیف پول Cortex از دفتر اعتبار واقعی تغذیه می‌شود؛ هر برداشت، شارژ و مصرف در Ledger ثبت می‌شود.</p>

            <div className="mt-7 flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">اعتبار قابل استفاده</p>
                <p className="mt-1 text-4xl font-black tracking-tight sm:text-5xl">{faNum(data.account.balanceCredits)}</p>
              </div>
              <div className="pb-1">
                <p className="text-[11px] font-medium text-muted-foreground">مصرف ۳۰ روز اخیر</p>
                <p className="mt-1 text-2xl font-bold">{faNum(data.usage30Days.credits)} <span className="text-xs font-medium text-muted-foreground">اعتبار</span></p>
              </div>
            </div>

            <div className="mt-6 max-w-xl">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>نسبت به اعتبار ماهانه پلن</span>
                <span>{faNum(balanceProgress)}٪</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-primary via-sky-300 to-violet-400 shadow-[0_0_22px_rgba(91,140,255,.35)]" style={{ width: balanceProgress + "%" }} />
              </div>
            </div>
          </div>

          <div className="mx-auto grid place-items-center [transform-style:preserve-3d] lg:me-2">
            <div className="relative grid place-items-center [transform-style:preserve-3d]">
              <div className="absolute size-52 rounded-full border border-primary/10 animate-pulse" />
              <div className="absolute size-44 rounded-full border border-violet-400/10 [transform:rotateX(70deg)]" />
              <div className="cortex-wallet-orb relative grid place-items-center">
                <div className="grid size-16 place-items-center rounded-2xl border border-white/10 bg-black/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur">
                  <WalletCards className="size-7" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {shadow && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/[.04] p-4 text-xs leading-6 text-amber-100/80">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <span>حساب مالی فعلاً در حالت حسابداری/آزمایشی است؛ مصرف ثبت می‌شود، اما کسر اعتبار و مسدودسازی تا فعال‌سازی تجاری این workspace اعمال نمی‌شود.</span>
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard icon={Sparkles} title="اعتبار فعلی" value={faNum(data.account.balanceCredits)} caption="CREDITS" />
        <MetricCard icon={Activity} title="مصرف ۳۰ روز اخیر" value={faNum(data.usage30Days.credits)} caption={faNum(data.usage30Days.tokens) + " توکن"} />
        <MetricCard icon={CreditCard} title="پایان دوره" value={new Date(data.account.periodEnd).toLocaleDateString("fa-IR")} caption="چرخه فعلی" />
      </section>

      <section className="cortex-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="cortex-kicker">TOP UP</p>
            <h3 className="mt-2 text-xl font-bold">شارژ اعتبار Cortex</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">انتخاب بسته یک درخواست واقعی ایجاد می‌کند؛ پس از تأیید مدیریت، اعتبار مستقیماً وارد Ledger و موجودی می‌شود.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-primary"><ShieldCheck className="size-4" />ضد دوباره‌کاری با Ledger</div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {data.topUpPackages.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onClick={() => topUp.mutate(item.key)}
              disabled={topUp.isPending}
              className="cortex-wallet-package group rounded-2xl border border-white/[.08] bg-white/[.02] p-5 text-right disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-11 place-items-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                  {index === 0 ? <Plus className="size-5" /> : index === 1 ? <Layers3 className="size-5" /> : <WalletCards className="size-5" />}
                </span>
                <ArrowUpLeft className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1" />
              </div>
              <p className="mt-5 text-lg font-bold">{item.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{index === 0 ? "برای شروع سریع" : index === 1 ? "برای مصرف جدی" : "برای تیم‌های پرترافیک"}</p>
              <p className="mt-4 text-2xl font-black">{faNum(item.credits)}</p>
              <p className="mt-1 text-xs text-muted-foreground">اعتبار</p>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[.06] pt-3">
                <span className="text-sm font-bold">{faNum(item.amountToman)} تومان</span>
                <span className="text-[10px] text-primary">{topUp.isPending ? "در حال ثبت…" : "درخواست شارژ"}</span>
              </div>
            </button>
          ))}
        </div>

        {pendingRequests > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-400/[.04] px-4 py-3 text-xs text-amber-100/80">
            <Clock3 className="me-1 inline size-3.5 text-amber-300" />{faNum(pendingRequests)} درخواست شارژ در انتظار بررسی مدیریت است.
          </div>
        )}
      </section>

      <section className="cortex-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="cortex-kicker">INVOICES</p><h3 className="mt-2 text-xl font-bold">صورتحساب‌ها</h3><p className="mt-1 text-xs leading-6 text-muted-foreground">سوابق صورتحساب همین workspace از Backend خوانده می‌شود.</p></div>
          <div className="flex items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.02] px-3 py-2 text-[10px] text-muted-foreground"><FileText className="size-3.5 text-primary"/>{faNum(data.invoices.length)} رکورد اخیر</div>
        </div>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[.06]">
          <table className="w-full min-w-[720px] text-right text-xs">
            <thead className="bg-white/[.02] text-muted-foreground"><tr><th className="px-4 py-3">شماره</th><th className="px-4 py-3">وضعیت</th><th className="px-4 py-3">دوره</th><th className="px-4 py-3">مبلغ</th><th className="px-4 py-3">پرداخت</th></tr></thead>
            <tbody className="divide-y divide-white/[.05]">
              {data.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-4 py-3 font-mono">{invoice.invoiceNumber}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{invoice.status}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(invoice.periodStart).toLocaleDateString("fa-IR")} تا {new Date(invoice.periodEnd).toLocaleDateString("fa-IR")}</td>
                  <td className="px-4 py-3 font-semibold">{faNum(invoice.totalToman)} تومان</td>
                  <td className="px-4 py-3">{invoice.paidAt ? <span className="text-emerald-300">{new Date(invoice.paidAt).toLocaleDateString("fa-IR")}</span> : <span className="text-muted-foreground">—</span>}</td>
                </tr>
              ))}
              {data.invoices.length===0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">هنوز صورتحساب ثبت نشده است.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="cortex-panel rounded-2xl">
          <CardHeader className="border-b border-white/[.06]">
            <CardTitle className="text-base">وضعیت درخواست‌های شارژ</CardTitle>
            <CardDescription>آخرین درخواست‌های ثبت‌شده برای این workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {data.topUpRequests.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">هنوز درخواست شارژی ثبت نشده است.</p>
            ) : data.topUpRequests.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/[.06] bg-white/[.015] p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/10 bg-primary/5 text-primary"><CreditCard className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{faNum(item.credits)} اعتبار · {faNum(item.amountToman)} تومان</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleString("fa-IR")}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="cortex-panel rounded-2xl">
          <CardHeader><CardTitle className="text-base">آخرین تغییرات دفتر اعتبار</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-4">
            {data.ledger.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">هنوز رکورد مالی ثبت نشده است.</p>
            ) : data.ledger.slice(0, 8).map((x) => (
              <div key={x.id} className="flex items-center gap-3 rounded-xl border border-white/[.06] p-3">
                <span className={cn("text-sm font-black", x.amountCredits >= 0 ? "text-emerald-300" : "text-amber-300")}>{x.amountCredits >= 0 ? "+" : ""}{faNum(x.amountCredits)}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{x.description || x.entryType}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(x.createdAt).toLocaleString("fa-IR")}</p></div>
                <span className="text-[10px] text-muted-foreground">{faNum(x.balanceAfter)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="cortex-panel rounded-2xl">
          <CardHeader><CardTitle className="text-base">پلن‌های آماده</CardTitle><CardDescription>قیمت و سقف اعتبار از کاتالوگ تجاری Cortex خوانده می‌شود.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {data.plans.map((item) => (
              <div key={item.id} className={item.key === plan.key ? "rounded-2xl border border-primary/35 bg-primary/[.05] p-4" : "rounded-2xl border border-white/[.06] p-4"}>
                <div className="flex items-center justify-between gap-3"><p className="font-semibold">{item.name}</p>{item.key === plan.key && <Badge variant="outline" className="text-[10px]">فعال</Badge>}</div>
                <p className="mt-2 text-xl font-bold">{item.priceToman ? faNum(item.priceToman) + " تومان" : "رایگان / سفارشی"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.monthlyCredits ? faNum(item.monthlyCredits) + " اعتبار ماهانه" : "اعتبار سفارشی"}</p>
                {item.description && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{item.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="cortex-panel rounded-2xl">
          <CardHeader><CardTitle className="text-base">مدل‌های تجاری</CardTitle><CardDescription>رجیستری مدل‌ها و دسترسی پلن فعلی.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {byProvider.map(([provider, count]) => <div key={provider} className="flex items-center justify-between rounded-xl border border-white/[.06] p-3"><span className="text-sm">{provider}</span><span className="text-xs text-muted-foreground">{faNum(count)} مدل</span></div>)}
            <p className="pt-2 text-[11px] leading-5 text-muted-foreground"><CircleDollarSign className="me-1 inline size-3.5" />ضرایب مصرف مدل‌ها در لایه Billing تعیین می‌شوند و از موجودی اعتبار همین workspace کسر می‌شوند.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
