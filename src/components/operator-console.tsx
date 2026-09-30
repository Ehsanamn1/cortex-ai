"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Activity, Blocks, Bot, Boxes, BrainCircuit, Check, ChevronLeft, CircleAlert,
  CircleCheck, CloudCog, Database, FileText, Gauge, KeyRound, LayoutDashboard,
  Link2, ListFilter, LockKeyhole, LogOut, Menu, Moon, Pencil, Plus, RefreshCw, Search,
  ServerCog, Settings2, ShieldCheck, Sparkles, Sun, TrendingUp, Users, WalletCards, Workflow,
} from "lucide-react";
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Section = "overview" | "providers" | "models" | "billing" | "site" | "resources" | "telegram" | "security";

const NAV: Array<{ id: Section; label: string; group: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "نمای کلی", group: "مرکز عملیات", icon: LayoutDashboard },
  { id: "providers", label: "Provider Registry", group: "هوش و زیرساخت", icon: CloudCog },
  { id: "models", label: "مدل‌ها و مسیرها", group: "هوش و زیرساخت", icon: BrainCircuit },
  { id: "billing", label: "پلن، اعتبار و سود", group: "مالی", icon: WalletCards },
  { id: "site", label: "محتوا و ظاهر سایت", group: "سیستم", icon: Blocks },
  { id: "resources", label: "منابع سیستم", group: "سیستم", icon: Database },
  { id: "telegram", label: "Telegram Operations", group: "اتصال‌ها", icon: Bot },
  { id: "security", label: "امنیت و دسترسی", group: "سیستم", icon: ShieldCheck },
];

const RESOURCE_OPTIONS = [
  ["users", "کاربران", Users],
  ["workspaces", "فضاهای کاری", Boxes],
  ["agents", "ایجنت‌ها", Bot],
  ["knowledge", "پایگاه دانش", Database],
  ["conversations", "گفتگوها", FileText],
  ["telegram", "بات‌های Telegram", Bot],
  ["workflows", "Workflowها", Workflow],
  ["executions", "Executionها", Activity],
  ["audit", "Audit Log", ShieldCheck],
  ["plugins", "افزونه‌ها", Settings2],
  ["training", "آموزش و مدل‌های اختصاصی", Sparkles],
] as const;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error(body?.error?.message || body?.message || body?.error || "درخواست ناموفق بود.");
  return body?.data ?? body;
}

function toman(value: number | null | undefined) {
  return Math.max(0, Math.round(Number(value ?? 0))).toLocaleString("fa-IR") + " تومان";
}
function tomanSigned(value: number | null | undefined) {
  const n = Math.round(Number(value ?? 0));
  return (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("fa-IR") + " تومان";
}
function num(value: number | null | undefined) {
  return Math.round(Number(value ?? 0)).toLocaleString("fa-IR");
}
function shortDate(value: string) {
  try { return new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(new Date(value)); } catch { return "—"; }
}

function OpsCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={"operator-card " + className}>{children}</section>;
}

function MetricCard({ label, value, caption, icon: Icon, tone = "blue" }: {
  label: string; value: string; caption: string; icon: typeof Activity; tone?: "blue" | "green" | "amber" | "violet";
}) {
  return (
    <div className={"operator-metric operator-metric-" + tone}>
      <div className="operator-metric-icon"><Icon className="size-5" /></div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-[var(--op-muted)]">{label}</p>
        <p className="mt-1 text-[clamp(1.45rem,2.7vw,2rem)] font-black tracking-tight text-[var(--op-fg)]">{value}</p>
        <p className="mt-1 text-[10px] text-[var(--op-muted)]">{caption}</p>
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-[10px] font-black tracking-[.18em] text-[var(--op-primary)]">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-[var(--op-fg)]">{title}</h1>
        <p className="mt-2 max-w-3xl text-xs leading-6 text-[var(--op-muted)]">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, variant = "primary", type = "button" }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "outline" | "ghost" | "danger"; type?: "button" | "submit";
}) {
  return <button type={type} onClick={onClick} disabled={disabled} className={"operator-button operator-button-" + variant + " disabled:cursor-not-allowed disabled:opacity-50"}>{children}</button>;
}

function Field({ label, value, onChange, placeholder, type = "text", dir, disabled }: {
  label: string; value: string | number; onChange: (value: string) => void; placeholder?: string; type?: string; dir?: "ltr" | "rtl"; disabled?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] font-bold text-[var(--op-muted)]">{label}</span>
      <input
        type={type}
        dir={dir}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="operator-input"
      />
    </label>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label?: string }) {
  return <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-xs text-[var(--op-muted)]">
    <span className={"operator-toggle " + (checked ? "is-on" : "")}><span /></span>{label ? <span>{label}</span> : null}
  </button>;
}

function Overview({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const q = useQuery({ queryKey: ["ops-overview"], queryFn: () => fetchJson<any>("/api/control-center"), staleTime: 10_000, refetchInterval: 30_000 });
  if (q.isPending) return <div className="operator-loading">در حال ساخت نمای عملیاتی…</div>;
  if (q.isError) return <OpsCard><div className="p-8 text-center text-sm text-rose-500">{(q.error as Error).message}</div></OpsCard>;
  const data = q.data;
  const revenue = Number(data.financial?.last30Days?.cashRevenueToman ?? 0);
  const cost = Number(data.financial?.last30Days?.providerCostToman ?? 0);
  const booked = Number(data.financial?.last30Days?.bookedMonthlyPlanValueToman ?? 0);
  const points = new Map<string, { day: string; revenue: number; cost: number }>();
  for (const row of (data.financial?.daily?.revenue ?? [])) points.set(row.day.slice(0, 10), { day: row.day, revenue: Number(row.revenueToman), cost: 0 });
  for (const row of (data.financial?.daily?.providerCost ?? [])) {
    const key = row.day.slice(0, 10);
    const prev = points.get(key) ?? { day: row.day, revenue: 0, cost: 0 };
    prev.cost = Number(row.costToman);
    points.set(key, prev);
  }
  const chart = Array.from(points.values()).sort((a, b) => a.day.localeCompare(b.day)).map((row) => ({
    ...row, label: shortDate(row.day), margin: row.revenue - row.cost,
  }));
  const margin = revenue - cost;
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="OPERATOR CONSOLE"
        title="مرکز فرمان واقعی Cortex"
        description="درآمد، هزینه تأمین مدل، Providerها، مسیرهای مدل، منابع و تنظیمات کل محصول از یک نقطه کنترل می‌شوند."
        action={<div className="flex gap-2"><PrimaryButton variant="outline" onClick={() => onNavigate("providers")}><CloudCog className="size-4" /> زیرساخت مدل</PrimaryButton><PrimaryButton onClick={() => onNavigate("site")}><Pencil className="size-4" /> تغییر محتوای سایت</PrimaryButton></div>}
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="فروش ثبت‌شده ۳۰ روز" value={toman(revenue)} caption="پرداخت‌های واقعی ثبت‌شده" icon={TrendingUp} tone="green" />
        <MetricCard label="هزینه تأمین AI" value={toman(cost)} caption="بر اساس توکن و نرخ Provider" icon={ServerCog} tone="amber" />
        <MetricCard label="حاشیه عملیاتی" value={tomanSigned(margin)} caption={margin >= 0 ? "فروش منهای هزینه تأمین" : "هزینه تأمین از فروش بیشتر است"} icon={Gauge} tone={margin >= 0 ? "blue" : "amber"} />
        <MetricCard label="ارزش پلن‌های فعال" value={toman(booked)} caption={num(data.financial?.activeSubscriptions) + " اشتراک فعال"} icon={WalletCards} tone="violet" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <OpsCard className="min-h-[390px]">
          <div className="operator-card-head">
            <div><p className="operator-eyebrow">FINANCE SIGNAL</p><h2 className="operator-card-title">فروش، هزینه و حاشیه سود</h2></div>
            <div className="operator-mini-stat"><span>نرخ مبنا</span><b>{num(data.financial?.usdTomanRate)}</b></div>
          </div>
          <div className="h-[300px] px-2 pb-3 pt-5">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart}>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--op-grid)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--op-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--op-muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => Number(v).toLocaleString("fa-IR")} />
                <Tooltip
                  contentStyle={{ background: "var(--op-card)", border: "1px solid var(--op-border)", borderRadius: 12, color: "var(--op-fg)" }}
                  formatter={(value: any, name: string) => [tomanSigned(Number(value)), name === "revenue" ? "فروش" : name === "cost" ? "هزینه" : "حاشیه"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#356dff" fill="rgba(53,109,255,.10)" strokeWidth={2} />
                <Line type="monotone" dataKey="cost" stroke="#e0a23c" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="margin" stroke="#24a36b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </OpsCard>
        <div className="grid gap-4">
          <OpsCard className="operator-depth">
            <div className="operator-card-head"><div><p className="operator-eyebrow">SYSTEM MAP</p><h2 className="operator-card-title">وضعیت شبکه</h2></div><Sparkles className="size-5 text-[var(--op-primary)]" /></div>
            <div className="grid grid-cols-2 gap-2 p-4">
              {[["کاربر", data.metrics.users], ["Workspace", data.metrics.workspaces], ["Agent", data.metrics.agents], ["Knowledge", data.metrics.knowledge], ["Conversation", data.metrics.conversations], ["Telegram", data.metrics.bots]].map(([label, value]) => <div key={String(label)} className="operator-data-chip"><span>{label}</span><b>{num(Number(value))}</b></div>)}
            </div>
          </OpsCard>
          <OpsCard className="operator-depth">
            <div className="operator-card-head"><div><p className="operator-eyebrow">ROUTING</p><h2 className="operator-card-title">سیستم مدل</h2></div><BrainCircuit className="size-5 text-[var(--op-primary)]" /></div>
            <div className="space-y-2 p-4">
              {(data.usageSummary?.models ?? []).slice(0, 4).map((item: any) => <div key={item.provider + item.model} className="flex items-center gap-3 rounded-xl border border-[var(--op-border)] px-3 py-2.5"><span className="grid size-8 place-items-center rounded-lg bg-[var(--op-soft)] text-[var(--op-primary)]"><BrainCircuit className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[var(--op-fg)]">{item.model}</p><p className="truncate text-[10px] text-[var(--op-muted)]">{item.provider}</p></div><span className="text-[10px] font-bold text-[var(--op-muted)]">{num(item.tokens)} توکن</span></div>)}
            </div>
          </OpsCard>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {([
          { title: "Provider Registry", desc: "Base URL، API Key، Health و کشف مدل", target: "providers", Icon: CloudCog },
          { title: "مدل‌ها و مسیرها", desc: "Route Key، قیمت تأمین، پلن و حاشیه", target: "models", Icon: BrainCircuit },
          { title: "محتوا و ظاهر", desc: "متن‌ها، منوها، CTA و ظاهر محصول", target: "site", Icon: Blocks },
          { title: "منابع سیستم", desc: "کاربران، Agent، دانش، Telegram و Log", target: "resources", Icon: Database },
        ] satisfies Array<{ title: string; desc: string; target: Section; Icon: typeof CloudCog }>).map(({ title, desc, target, Icon }) => <button key={target} onClick={() => onNavigate(target)} className="operator-launch-card"><span className="operator-launch-icon"><Icon className="size-5" /></span><span className="min-w-0 flex-1 text-right"><b>{title}</b><small>{desc}</small></span><ChevronLeft className="size-4 shrink-0 text-[var(--op-muted)]" /></button>)}
      </div>
    </div>
  );
}

function ProviderRegistry() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ops-providers"], queryFn: () => fetchJson<any>("/api/control-center/providers"), staleTime: 10_000 });
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ displayName: "", key: "", providerName: "", protocol: "openai-compatible", authMode: "bearer", baseUrl: "", apiKey: "", enabled: true, isTrialProvider: false });
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [modelDraft, setModelDraft] = useState({ modelId: "", displayName: "", inputTomanPer1M: "0", outputTomanPer1M: "0" });

  function reset(provider?: any) {
    setEditing(provider ?? null);
    setDiscovered([]);
    setModelDraft({ modelId: "", displayName: "", inputTomanPer1M: "0", outputTomanPer1M: "0" });
    setForm(provider ? {
      displayName: provider.displayName, key: provider.key, providerName: provider.providerName,
      protocol: provider.protocol, authMode: provider.authMode, baseUrl: provider.baseUrl,
      apiKey: "", enabled: provider.enabled, isTrialProvider: provider.isTrialProvider,
    } : { displayName: "", key: "", providerName: "", protocol: "openai-compatible", authMode: "bearer", baseUrl: "", apiKey: "", enabled: true, isTrialProvider: false });
  }
  async function save() {
    try {
      const payload = { ...form, ...(editing ? { id: editing.id } : {}) };
      await fetchJson("/api/control-center/providers", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      toast.success("Provider ذخیره شد.");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["ops-providers"] });
      await qc.invalidateQueries({ queryKey: ["ops-billing"] });
    } catch (error) { toast.error((error as Error).message); }
  }
  async function test() {
    if (!editing) return toast.error("ابتدا Provider را ذخیره کن.");
    try {
      const result = await fetchJson<any>("/api/control-center/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", providerId: editing.id, modelId: modelDraft.modelId }) });
      if (result.health?.ok) toast.success("اتصال سالم است · " + num(result.health.latencyMs) + "ms");
      else toast.error(result.health?.error || "تست اتصال ناموفق بود.");
      await qc.invalidateQueries({ queryKey: ["ops-providers"] });
    } catch (error) { toast.error((error as Error).message); }
  }
  async function discover() {
    if (!editing) return toast.error("ابتدا Provider را ذخیره کن.");
    try {
      const result = await fetchJson<any>("/api/control-center/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discover_models", providerId: editing.id }) });
      setDiscovered(result.models ?? []);
      toast.success((result.models ?? []).length + " مدل پیدا شد.");
    } catch (error) { toast.error((error as Error).message); }
  }
  async function addModel() {
    if (!editing || !modelDraft.modelId.trim()) return;
    try {
      await fetchJson("/api/control-center/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "create_model",
        provider: editing.providerName,
        modelId: modelDraft.modelId.trim(),
        displayName: modelDraft.displayName.trim() || modelDraft.modelId.trim(),
        inputTomanPer1M: Number(modelDraft.inputTomanPer1M) || 0,
        outputTomanPer1M: Number(modelDraft.outputTomanPer1M) || 0,
        systemProviderId: editing.id,
        active: true,
        commercialAvailable: true,
        trialEnabled: false,
        vision: false,
        tools: true,
        reasoning: false,
      })});
      toast.success("مدل به کاتالوگ اضافه شد.");
      await qc.invalidateQueries({ queryKey: ["ops-billing"] });
    } catch (error) { toast.error((error as Error).message); }
  }

  if (q.isPending) return <div className="operator-loading">در حال بارگذاری Provider Registry…</div>;
  if (q.isError) return <OpsCard><div className="p-8 text-center text-sm text-rose-500">{(q.error as Error).message}</div></OpsCard>;
  const providers = q.data?.providers ?? [];
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="MODEL INFRASTRUCTURE" title="Provider Registry" description="هر Provider واقعی را با Base URL و API Key به Cortex وصل کن، اتصال را تست کن، مدل‌ها را کشف کن و بعد آن‌ها را وارد Model Catalog کن." action={<PrimaryButton onClick={() => reset()}><Plus className="size-4" /> Provider جدید</PrimaryButton>} />
      <div className="grid gap-4 xl:grid-cols-[.75fr_1.25fr]">
        <div className="space-y-3">
          {providers.length === 0 ? <OpsCard><div className="p-8 text-center text-sm text-[var(--op-muted)]">هنوز Provider ثبت نشده.</div></OpsCard> : providers.map((provider: any) => (
            <button key={provider.id} onClick={() => reset(provider)} className={"operator-provider-row " + (editing?.id === provider.id ? "is-active" : "")}>
              <span className="operator-provider-mark"><ServerCog className="size-4" /></span>
              <span className="min-w-0 flex-1 text-right"><b>{provider.displayName}</b><small>{provider.providerName} · {provider.protocol}</small><small dir="ltr" className="truncate">{provider.baseUrl}</small></span>
              <span className="text-left"><span className={"operator-status-dot " + (provider.lastHealthStatus === "healthy" ? "ok" : "")} /><small>{provider.lastHealthStatus || "unknown"}</small></span>
            </button>
          ))}
        </div>
        <OpsCard>
          {!editing ? <div className="grid min-h-[520px] place-items-center p-10 text-center"><div><CloudCog className="mx-auto size-10 text-[var(--op-primary)]" /><h2 className="mt-4 text-lg font-black text-[var(--op-fg)]">Registry مرکزی</h2><p className="mt-2 max-w-md text-xs leading-6 text-[var(--op-muted)]">یک Provider را انتخاب کن یا Provider جدید بساز. Base URL، کلید و Modelها از همین‌جا مدیریت می‌شوند.</p></div></div> : (
            <div className="space-y-5 p-5">
              <div className="flex flex-col gap-3 border-b border-[var(--op-border)] pb-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="operator-eyebrow">CONNECTION</p><h2 className="operator-card-title">{form.displayName || "Provider جدید"}</h2></div><div className="flex gap-2"><Toggle checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} label="فعال" /><Toggle checked={form.isTrialProvider} onChange={(v) => setForm({ ...form, isTrialProvider: v })} label="Provider آزمایشی" /></div></div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="نام نمایشی" value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} placeholder="مثلاً DeepSeek Production" />
                <Field label="کلید داخلی" value={form.key} onChange={(v) => setForm({ ...form, key: v })} placeholder="deepseek-prod" dir="ltr" disabled={!!editing} />
                <Field label="Provider Name" value={form.providerName} onChange={(v) => setForm({ ...form, providerName: v })} placeholder="DeepSeek" />
                <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-[var(--op-muted)]">Protocol</span><select value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })} className="operator-input"><option value="openai-compatible">OpenAI Compatible</option><option value="openrouter">OpenRouter</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option></select></label>
                <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-[var(--op-muted)]">Auth Mode</span><select value={form.authMode} onChange={(e) => setForm({ ...form, authMode: e.target.value })} className="operator-input"><option value="bearer">Bearer</option><option value="x-api-key">X-API-Key</option><option value="none">بدون کلید</option></select></label>
                <Field label="Base URL / API URL" value={form.baseUrl} onChange={(v) => setForm({ ...form, baseUrl: v })} placeholder="https://api.example.com/v1" dir="ltr" />
                <Field label="API Key" value={form.apiKey} onChange={(v) => setForm({ ...form, apiKey: v })} placeholder={editing ? "برای حفظ کلید فعلی خالی بگذار" : "sk-…"} dir="ltr" />
              </div>
              <div className="operator-callout"><KeyRound className="size-4" /><div><b>کلید در DB به‌صورت رمزنگاری‌شده ذخیره می‌شود.</b><small>در UI هیچ‌وقت مقدار کلید ذخیره‌شده نمایش داده نمی‌شود. Worker فقط هنگام اجرای Provider آن را decrypt می‌کند.</small></div></div>
              <div className="flex flex-wrap gap-2"><PrimaryButton onClick={save}><Check className="size-4" /> ذخیره Provider</PrimaryButton>{editing ? <><PrimaryButton variant="outline" onClick={test}><Activity className="size-4" /> تست اتصال</PrimaryButton><PrimaryButton variant="outline" onClick={discover}><ListFilter className="size-4" /> کشف مدل‌ها</PrimaryButton></> : null}</div>
              {editing && <div className="operator-model-discovery"><div className="flex items-center justify-between gap-3"><div><p className="operator-eyebrow">MODEL DISCOVERY</p><h3 className="text-sm font-black text-[var(--op-fg)]">مدل‌های قابل دریافت</h3></div><span className="text-[10px] text-[var(--op-muted)]">{num(discovered.length)} مدل</span></div><div className="mt-3 max-h-52 space-y-1 overflow-auto pr-1">{discovered.map((model) => <button key={model} type="button" onClick={() => setModelDraft({ ...modelDraft, modelId: model, displayName: model })} className="flex w-full items-center gap-2 rounded-lg border border-[var(--op-border)] px-3 py-2 text-right hover:border-[var(--op-primary)]/35"><BrainCircuit className="size-3.5 text-[var(--op-primary)]" /><span dir="ltr" className="min-w-0 flex-1 truncate text-left text-xs font-mono text-[var(--op-fg)]">{model}</span><ChevronLeft className="size-3 text-[var(--op-muted)]" /></button>)}</div><div className="mt-4 grid gap-2 md:grid-cols-4"><Field label="Model ID" value={modelDraft.modelId} onChange={(v) => setModelDraft({ ...modelDraft, modelId: v })} dir="ltr" /><Field label="نام نمایشی" value={modelDraft.displayName} onChange={(v) => setModelDraft({ ...modelDraft, displayName: v })} /><Field label="هزینه ورودی / ۱M توکن (تومان)" value={modelDraft.inputTomanPer1M} onChange={(v) => setModelDraft({ ...modelDraft, inputTomanPer1M: v })} type="number" dir="ltr" /><Field label="هزینه خروجی / ۱M توکن (تومان)" value={modelDraft.outputTomanPer1M} onChange={(v) => setModelDraft({ ...modelDraft, outputTomanPer1M: v })} type="number" dir="ltr" /></div><div className="mt-3 flex justify-end"><PrimaryButton onClick={addModel} disabled={!modelDraft.modelId.trim()}><Plus className="size-4" /> افزودن به کاتالوگ</PrimaryButton></div></div>}
            </div>
          )}
        </OpsCard>
      </div>
    </div>
  );
}

function ModelsPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ops-billing"], queryFn: () => fetchJson<any>("/api/control-center/billing"), staleTime: 10_000 });
  const [selected, setSelected] = useState<any | null>(null);
  if (q.isPending) return <div className="operator-loading">در حال بارگذاری مدل‌ها…</div>;
  if (q.isError) return <OpsCard><div className="p-8 text-center text-sm text-rose-500">{(q.error as Error).message}</div></OpsCard>;
  const models = q.data?.models ?? [];
  const plans = q.data?.plans ?? [];
  const patch = async (payload: Record<string, unknown>) => {
    try {
      await fetchJson("/api/control-center/billing", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      toast.success("تغییر مدل ذخیره شد.");
      await qc.invalidateQueries({ queryKey: ["ops-billing"] });
    } catch (error) { toast.error((error as Error).message); }
  };
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="MODEL ROUTING" title="مدل‌ها و مسیرها" description="Model Catalog، Provider binding، قیمت تأمین، قابلیت‌ها و دسترسی هر پلن از یک لایه مرکزی کنترل می‌شود." action={<div className="flex gap-2"><PrimaryButton variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["ops-billing"] })}><RefreshCw className="size-4" /> تازه‌سازی</PrimaryButton></div>} />
      <div className="grid gap-3 xl:grid-cols-3">{models.map((model: any) => {
        const provider = model.systemProvider;
        const inputToman = provider?.enabled ? Number(model.inputUsdPer1M || 0) * Number(q.data.fx?.usdToman ?? 0) : 0;
        const outputToman = provider?.enabled ? Number(model.outputUsdPer1M || 0) * Number(q.data.fx?.usdToman ?? 0) : 0;
        return (
          <button type="button" key={model.id} onClick={() => setSelected({ ...model, fxUsdToman: q.data.fx?.usdToman ?? 0 })} className="operator-model-card text-right">
            <div className="flex items-start gap-3"><span className="operator-model-mark"><BrainCircuit className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="truncate text-sm text-[var(--op-fg)]">{model.displayName}</b>{model.trialDefault ? <span className="operator-badge operator-badge-blue">Trial</span> : null}</div><p className="mt-1 truncate text-[10px] text-[var(--op-muted)]">{model.systemProvider?.displayName || model.provider}</p><p dir="ltr" className="mt-2 truncate text-[11px] font-mono text-[var(--op-fg)]">{model.modelId}</p></div></div>
            <div className="mt-4 grid grid-cols-2 gap-2"><div className="operator-data-chip"><span>ورودی</span><b>{inputToman ? toman(inputToman * 1) : "تعریف نشده"}</b></div><div className="operator-data-chip"><span>خروجی</span><b>{outputToman ? toman(outputToman * 1) : "تعریف نشده"}</b></div></div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-[var(--op-muted)]"><span>{model.active ? "فعال" : "خاموش"}</span><span>{model.tools ? "Tools" : "No tools"} · {model.reasoning ? "Reasoning" : "Standard"}</span></div>
          </button>
        );
      })}</div>
      <OpsCard><div className="operator-card-head"><div><p className="operator-eyebrow">PLAN ACCESS</p><h2 className="operator-card-title">ماتریس دسترسی و حاشیه</h2></div><span className="operator-badge operator-badge-green">حداقل سود هدف: ۱۰۰٪</span></div><div className="overflow-x-auto p-4"><table className="w-full min-w-[900px] text-right text-[11px]"><thead><tr className="border-b border-[var(--op-border)] text-[var(--op-muted)]"><th className="px-3 py-2">مدل</th>{plans.map((plan:any) => <th key={plan.id} className="px-3 py-2">{plan.name}</th>)}</tr></thead><tbody>{models.map((model:any) => <tr key={model.id} className="border-b border-[var(--op-border)] last:border-0"><td className="px-3 py-3 font-semibold text-[var(--op-fg)]">{model.displayName}</td>{plans.map((plan:any) => { const access=model.planAccess?.find((x:any)=>x.planId===plan.id); return <td key={plan.id} className="px-3 py-3"><div className="flex items-center gap-2"><Toggle checked={Boolean(access?.enabled)} onChange={(checked)=>patch({ action:"set_access", id:"access", planId:plan.id, modelCatalogId:model.id, enabled:checked, creditMultiplierBps:Math.max(200, Number(access?.creditMultiplierBps ?? 200)) })} /><span className="text-[9px] text-[var(--op-muted)]">{Math.max(200, Number(access?.creditMultiplierBps ?? 200))} BPS</span></div></td>})}</tr>)}</tbody></table></div></OpsCard>

      {selected ? <ModelEditor model={selected} onClose={() => setSelected(null)} onSave={patch} plans={plans} /> : null}
    </div>
  );
}

function ModelEditor({ model, onClose, onSave, plans }: { model: any; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void>; plans: any[] }) {
  const [name, setName] = useState(model.displayName);
  const [routeKey, setRouteKey] = useState(model.routeKey || "");
  const [input, setInput] = useState(String(Math.round(Number(model.inputUsdPer1M ?? 0) * Number(model.fxUsdToman ?? 0))));
  const [output, setOutput] = useState(String(Math.round(Number(model.outputUsdPer1M ?? 0) * Number(model.fxUsdToman ?? 0))));
  const [providerId, setProviderId] = useState(model.systemProviderId || "");
  const [active, setActive] = useState(Boolean(model.active));
  const [trial, setTrial] = useState(Boolean(model.trialDefault));
  const [tools, setTools] = useState(Boolean(model.tools));
  const [reasoning, setReasoning] = useState(Boolean(model.reasoning));
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
    <div className="operator-modal w-full max-w-3xl">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--op-border)] p-5"><div><p className="operator-eyebrow">MODEL EDITOR</p><h2 className="text-lg font-black text-[var(--op-fg)]">{name}</h2></div><button onClick={onClose} className="operator-icon-button" aria-label="بستن">×</button></div>
      <div className="grid gap-3 p-5 md:grid-cols-2"><Field label="نام نمایشی" value={name} onChange={setName}/><Field label="Route Key" value={routeKey} onChange={setRouteKey} dir="ltr"/><Field label="هزینه ورودی / ۱M توکن (تومان)" value={input} onChange={setInput} type="number" dir="ltr"/><Field label="هزینه خروجی / ۱M توکن (تومان)" value={output} onChange={setOutput} type="number" dir="ltr"/><Field label="System Provider ID" value={providerId} onChange={setProviderId} dir="ltr"/></div>
      <div className="grid gap-2 px-5 pb-5 md:grid-cols-2"><Toggle checked={active} onChange={setActive} label="فعال" /><Toggle checked={trial} onChange={setTrial} label="Trial Default" /><Toggle checked={tools} onChange={setTools} label="Tools" /><Toggle checked={reasoning} onChange={setReasoning} label="Reasoning" /></div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--op-border)] p-5"><PrimaryButton variant="outline" onClick={onClose}>انصراف</PrimaryButton><PrimaryButton onClick={() => void onSave({ action:"update_model", id:model.id, displayName:name, routeKey:routeKey || null, inputTomanPer1M:Number(input)||0, outputTomanPer1M:Number(output)||0, systemProviderId:providerId || null, active, trialDefault:trial, tools, reasoning })}>ذخیره مدل</PrimaryButton></div>
    </div>
  </div>;
}

function BillingPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ops-billing"], queryFn: () => fetchJson<any>("/api/control-center/billing"), staleTime: 10_000 });
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  if (q.isPending) return <div className="operator-loading">در حال بارگذاری مالی…</div>;
  if (q.isError) return <OpsCard><div className="p-8 text-center text-sm text-rose-500">{(q.error as Error).message}</div></OpsCard>;
  const plans = q.data?.plans ?? [];
  async function patch(payload: Record<string, unknown>) {
    try { await fetchJson("/api/control-center/billing",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); toast.success("ذخیره شد."); await qc.invalidateQueries({queryKey:["ops-billing"]}); } catch(e){toast.error((e as Error).message);}
  }
  return <div className="space-y-6">
    <SectionHeader eyebrow="BILLING CONTROL" title="پلن، اعتبار و سود" description="تمام قیمت‌ها در تومان هستند. قیمت‌گذاری مصرف هر مدل بر مبنای هزینه واقعی تأمین و ضریب حداقل ۲.۰۰ انجام می‌شود؛ یعنی حداقل ۱۰۰٪ مارک‌آپ روی هزینه تأمین قبل از سایر هزینه‌های کسب‌وکار." />
    <div className="grid gap-4 xl:grid-cols-3">{plans.map((plan:any) => {
      const unit = plan.monthlyCredits > 0 ? plan.priceToman / plan.monthlyCredits : 0;
      return <OpsCard key={plan.id}><div className="operator-card-head"><div><p className="operator-eyebrow">PLAN</p><h2 className="operator-card-title">{plan.name}</h2></div><button className="operator-icon-button" onClick={() => setEditingPlan(editingPlan?.id===plan.id?null:plan)}><Pencil className="size-4"/></button></div><div className="grid grid-cols-2 gap-2 p-4"><div className="operator-data-chip"><span>قیمت ماهانه</span><b>{toman(plan.priceToman)}</b></div><div className="operator-data-chip"><span>اعتبار ماهانه</span><b>{num(plan.monthlyCredits)}</b></div><div className="operator-data-chip"><span>ارزش هر اعتبار</span><b>{toman(unit)}</b></div><div className="operator-data-chip"><span>مازاد</span><b>{toman(plan.overageCreditPriceToman)}</b></div></div>{editingPlan?.id===plan.id ? <div className="grid gap-3 border-t border-[var(--op-border)] p-4 md:grid-cols-2"><Field label="نام" value={editingPlan.name} onChange={(v)=>setEditingPlan({...editingPlan,name:v})}/><Field label="قیمت ماهانه تومان" value={String(editingPlan.priceToman)} onChange={(v)=>setEditingPlan({...editingPlan,priceToman:Number(v)||0})} type="number" dir="ltr"/><Field label="اعتبار ماهانه" value={String(editingPlan.monthlyCredits)} onChange={(v)=>setEditingPlan({...editingPlan,monthlyCredits:Number(v)||0})} type="number" dir="ltr"/><Field label="قیمت اعتبار مازاد" value={String(editingPlan.overageCreditPriceToman)} onChange={(v)=>setEditingPlan({...editingPlan,overageCreditPriceToman:Number(v)||0})} type="number" dir="ltr"/><div className="flex gap-2 md:col-span-2"><PrimaryButton onClick={()=>patch({action:"update_plan",id:plan.id,name:editingPlan.name,priceToman:editingPlan.priceToman,monthlyCredits:editingPlan.monthlyCredits,overageCreditPriceToman:editingPlan.overageCreditPriceToman})}>ذخیره پلن</PrimaryButton></div></div>:null}</OpsCard>;
    })}</div>
    <OpsCard><div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start"><div className="operator-invariant-icon"><ShieldCheck className="size-5"/></div><div><h3 className="text-sm font-black text-[var(--op-fg)]">قاعده مالی Cortex</h3><p className="mt-1 text-xs leading-6 text-[var(--op-muted)]">برای هر Model Access، ضریب کمتر از ۲۰۰ BPS از طریق UI پذیرفته نمی‌شود. یعنی مبنای اعتبار حداقل ۲ برابر هزینه تأمین مدل است. ضریب بالاتر برای مدل‌های پرهزینه آزاد است.</p></div></div></OpsCard>
  </div>;
}

function SiteControl() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ops-site-settings"], queryFn: () => fetchJson<any>("/api/control-center/settings"), staleTime: 10_000 });
  const [draftValues, setDraftValues] = useState<Record<string, string> | null>(null);
  const values = draftValues ?? (q.data?.settings ?? {}) as Record<string, string>;
  async function save() {
    try {
      await fetchJson("/api/control-center/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({settings:values})});
      setDraftValues(values);
      toast.success("محتوا و تنظیمات سایت ذخیره شد.");
      await qc.invalidateQueries({queryKey:["ops-site-settings"]});
    } catch(e){toast.error((e as Error).message);}
  }
  const groups = [
    ["هویت و Landing", ["site.name","site.description","site.welcomeTitle","site.heroTitle","site.heroSubtitle","site.heroPrimaryCta","site.heroSecondaryCta","site.proofLine"]],
    ["احراز هویت", ["site.authTitle","site.authDescription"]],
    ["ظاهر", ["site.primaryColor","site.secondaryColor","site.radius","site.sidebarColor"]],
    ["منو", Object.keys(values).filter((key)=>key.startsWith("nav."))],
    ["قابلیت‌ها", Object.keys(values).filter((key)=>key.startsWith("feature."))],
  ];
  return <div className="space-y-6">
    <SectionHeader eyebrow="SITE CONTROL PLANE" title="محتوا و ظاهر سایت" description="متن‌های فروش، CTA، عنوان‌ها، منوها و feature flagها از همین‌جا کنترل می‌شوند؛ نیازی به تغییر کد برای Copy روزمره نیست." action={<PrimaryButton onClick={save}><Check className="size-4"/> ذخیره همه</PrimaryButton>} />
    {groups.map(([title, keys]) => <OpsCard key={String(title)}><div className="operator-card-head"><div><p className="operator-eyebrow">EDITABLE</p><h2 className="operator-card-title">{title}</h2></div></div><div className="grid gap-3 p-5 md:grid-cols-2">{(keys as string[]).map((key)=> <Field key={key} label={key} value={values[key] ?? ""} onChange={(v)=>setDraftValues({...values,[key]:v})} dir={key.includes("Color") || key.includes("radius") ? "ltr":"rtl"} />)}</div></OpsCard>)}
  </div>;
}

function ResourcesPanel() {
  const [resource, setResource] = useState("users");
  const [search, setSearch] = useState("");
  const q = useQuery({ queryKey: ["ops-resource", resource], queryFn: () => fetchJson<any>("/api/control-center/resources?resource=" + encodeURIComponent(resource)), staleTime: 8_000 });
  const qc = useQueryClient();
  async function toggle(row:any) {
    try { await fetchJson("/api/control-center/resources",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({resource,id:row.id,enabled:typeof row.enabled==="boolean"?!row.enabled:undefined,status:row.status==="active"?"paused":"active"})}); toast.success("وضعیت ذخیره شد."); await qc.invalidateQueries({queryKey:["ops-resource",resource]}); } catch(e){toast.error((e as Error).message);}
  }
  const rows=(q.data?.items??[]).filter((row:any)=>!search.trim()||JSON.stringify(row).toLowerCase().includes(search.trim().toLowerCase())).slice(0,150);
  return <div className="space-y-6">
    <SectionHeader eyebrow="SYSTEM RESOURCES" title="منابع و عملیات سیستم" description="جست‌وجو، بررسی و کنترل منابع کل سیستم بدون وابستگی به یک صفحه خاص." />
    <OpsCard><div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--op-border)] bg-[var(--op-input)] px-3"><Search className="size-4 text-[var(--op-muted)]"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="جست‌وجوی زنده در منابع…" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[var(--op-fg)] outline-none" /><button type="button" onClick={()=>setSearch("")} className={"text-[var(--op-muted)] " + (search ? "opacity-100" : "pointer-events-none opacity-0")}>×</button></div><div className="flex min-w-0 gap-2 overflow-x-auto">{RESOURCE_OPTIONS.map(([id,label,Icon])=><button key={id} onClick={()=>setResource(String(id))} className={"operator-filter " + (resource===id?"is-active":"")}><Icon className="size-3.5"/>{label}</button>)}</div></div><div className="overflow-x-auto border-t border-[var(--op-border)]"><table className="w-full min-w-[920px] text-right text-xs"><thead><tr className="border-b border-[var(--op-border)] text-[var(--op-muted)]"><th className="px-4 py-3">شناسه / نام</th><th className="px-4 py-3">وضعیت</th><th className="px-4 py-3">جزئیات</th><th className="px-4 py-3">عملیات</th></tr></thead><tbody>{q.isPending ? <tr><td colSpan={4} className="px-4 py-12 text-center text-[var(--op-muted)]">در حال بارگذاری…</td></tr> : rows.map((row:any)=><tr key={row.id} className="border-b border-[var(--op-border)] last:border-0"><td className="max-w-[280px] truncate px-4 py-3"><b className="text-[var(--op-fg)]">{row.name || row.title || row.email || row.id}</b><div className="mt-1 text-[10px] text-[var(--op-muted)]">{row.email || row.workspace?.name || row.agent?.name || "—"}</div></td><td className="px-4 py-3"><span className="operator-badge">{String(row.status || (row.enabled ? "enabled":"—"))}</span></td><td className="max-w-[380px] truncate px-4 py-3 text-[10px] text-[var(--op-muted)]">{JSON.stringify(row)}</td><td className="px-4 py-3">{["agents","plugins"].includes(resource) ? <PrimaryButton variant="outline" onClick={()=>toggle(row)}><RefreshCw className="size-3.5"/> تغییر وضعیت</PrimaryButton> : "—"}</td></tr>)}</tbody></table></div></OpsCard>
  </div>;
}

function TelegramPanel() {
  const q = useQuery({ queryKey:["ops-telegram"], queryFn:()=>fetchJson<any>("/api/control-center/resources?resource=telegram"), staleTime:10_000 });
  if(q.isPending) return <div className="operator-loading">در حال بارگذاری Telegram…</div>;
  const rows=q.data?.items??[];
  return <div className="space-y-6"><SectionHeader eyebrow="TELEGRAM OPERATIONS" title="Telegram Operations" description="مانیتورینگ Botها، Agentهای متصل و وضعیت کلی کانال‌ها."/><div className="grid gap-3 md:grid-cols-3"><MetricCard label="Botها" value={num(rows.length)} caption="اتصال‌های ثبت‌شده" icon={Bot}/><MetricCard label="متصل" value={num(rows.filter((x:any)=>x.status==="connected").length)} caption="بر اساس آخرین وضعیت" icon={CircleCheck} tone="green"/><MetricCard label="خطا" value={num(rows.filter((x:any)=>x.status==="error" || x.status==="failed").length)} caption="نیازمند بررسی" icon={CircleAlert} tone="amber"/></div><OpsCard><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-right text-xs"><thead><tr className="border-b border-[var(--op-border)] text-[var(--op-muted)]"><th className="px-4 py-3">Bot</th><th className="px-4 py-3">Workspace</th><th className="px-4 py-3">Agent</th><th className="px-4 py-3">وضعیت</th></tr></thead><tbody>{rows.map((row:any)=><tr key={row.id} className="border-b border-[var(--op-border)] last:border-0"><td className="px-4 py-3 font-semibold text-[var(--op-fg)]">{row.name}</td><td className="px-4 py-3 text-[var(--op-muted)]">{row.workspace?.name}</td><td className="px-4 py-3 text-[var(--op-muted)]">{row.agent?.name}</td><td className="px-4 py-3"><span className="operator-badge">{row.status}</span></td></tr>)}</tbody></table></div></OpsCard></div>;
}

function SecurityPanel({ onLogout }: { onLogout: () => void }) {
  return <div className="space-y-6"><SectionHeader eyebrow="SECURITY" title="امنیت و دسترسی" description="ورود مدیر با یک مسیر خصوصی unlisted انجام می‌شود. نام کاربری ثابت است و کلید Secret در URL حذف شده است."/><div className="grid gap-4 lg:grid-cols-2"><OpsCard><div className="space-y-4 p-5"><div className="operator-card-head"><div><p className="operator-eyebrow">OWNER</p><h2 className="operator-card-title">مدیر Cortex</h2></div><ShieldCheck className="size-5 text-emerald-500"/></div><div className="operator-data-chip"><span>نام کاربری</span><b dir="ltr">ehsanam86</b></div><div className="operator-callout"><LockKeyhole className="size-4"/><div><b>مسیر ورود عمومی نیست.</b><small>مسیر ورود به‌صورت محیطی و غیرقابل‌حدس تولید می‌شود و در URL ثابت پروژه وجود ندارد.</small></div></div><PrimaryButton variant="danger" onClick={onLogout}><LogOut className="size-4"/> خروج از پنل</PrimaryButton></div></OpsCard><OpsCard><div className="p-5"><p className="operator-eyebrow">SESSION</p><h2 className="operator-card-title mt-2">نشست داخلی پنل</h2><p className="mt-2 text-xs leading-6 text-[var(--op-muted)]">برای APIهای حساس یک HttpOnly session کوتاه‌مدت در مرورگر استفاده می‌شود؛ مقدار آن در UI یا URL نمایش داده نمی‌شود.</p></div></OpsCard></div></div>;
}

export function OperatorConsole() {
  const auth = useQuery({ queryKey: ["operator-auth"], queryFn: () => fetchJson<{ username: string }>("/api/admin/auth/me"), retry: false, staleTime: 0 });
  useEffect(() => {
    if (auth.isError) window.location.replace("/");
  }, [auth.isError]);
  const [section, setSection] = useState<Section>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("cortex-operator-theme") === "dark"
  );
  useEffect(() => {
    localStorage.setItem("cortex-operator-theme", dark ? "dark" : "light");
  }, [dark]);

  const logout = async () => {
    try { await fetchJson("/api/admin/auth/logout", { method: "POST" }); } finally { window.location.assign("/"); }
  };
  const content = section === "overview" ? <Overview onNavigate={setSection} />
    : section === "providers" ? <ProviderRegistry />
    : section === "models" ? <ModelsPanel />
    : section === "billing" ? <BillingPanel />
    : section === "site" ? <SiteControl />
    : section === "resources" ? <ResourcesPanel />
    : section === "telegram" ? <TelegramPanel />
    : <SecurityPanel onLogout={logout} />;

  if (auth.isPending || auth.isError) return <div className={"operator-console min-h-screen " + (dark ? "operator-dark" : "operator-light")} dir="rtl"><div className="operator-loading min-h-screen rounded-none border-0">در حال بررسی دسترسی امن پنل…</div></div>;

  return (
    <div className={"operator-console min-h-screen " + (dark ? "operator-dark" : "operator-light")} dir="rtl">
      <aside className={"operator-sidebar " + (mobileOpen ? "is-open" : "")}>
        <div className="flex items-center justify-between gap-3 p-5"><a href="#" className="flex items-center gap-2"><span className="grid size-10 place-items-center rounded-xl bg-[var(--op-primary)] text-white shadow-[0_12px_28px_rgba(53,109,255,.25)]"><Sparkles className="size-5"/></span><div><b className="block text-sm text-[var(--op-fg)]">Cortex Operator</b><small className="text-[10px] text-[var(--op-muted)]">Private control plane</small></div></a><button onClick={()=>setMobileOpen(false)} className="operator-icon-button lg:hidden" aria-label="بستن"><Menu className="size-4"/></button></div>
        <nav className="space-y-5 px-3 pb-5">{["مرکز عملیات","هوش و زیرساخت","مالی","سیستم","اتصال‌ها"].map(group=><div key={group}><p className="px-3 pb-2 text-[9px] font-black tracking-[.16em] text-[var(--op-muted)]">{group}</p><div className="space-y-1">{NAV.filter(item=>item.group===group).map(item=>{const Icon=item.icon; return <button key={item.id} onClick={()=>{setSection(item.id);setMobileOpen(false)}} className={"operator-nav-item " + (section===item.id?"is-active":"")}><Icon className="size-4"/><span>{item.label}</span></button>})}</div></div>)}</nav>
      </aside>
      {mobileOpen ? <button aria-label="بستن منو" onClick={()=>setMobileOpen(false)} className="fixed inset-0 z-[80] bg-black/30 lg:hidden"/> : null}
      <div className="operator-main">
        <header className="operator-topbar"><div className="flex min-w-0 items-center gap-3"><button className="operator-icon-button lg:hidden" onClick={()=>setMobileOpen(true)}><Menu className="size-4"/></button><div className="min-w-0"><p className="text-[9px] font-black tracking-[.16em] text-[var(--op-primary)]">CORTEX CONTROL PLANE</p><p className="truncate text-sm font-black text-[var(--op-fg)]">{NAV.find(x=>x.id===section)?.label}</p></div></div><div className="flex items-center gap-2"><button className="operator-theme" onClick={()=>setDark((v)=>!v)} aria-label="تغییر تم">{dark?<Sun className="size-4"/>:<Moon className="size-4"/>}</button><a href="/" className="operator-button operator-button-outline hidden sm:inline-flex"><Link2 className="size-4"/> سایت</a><button onClick={logout} className="operator-icon-button"><LogOut className="size-4"/></button></div></header>
        <main className="operator-content">{content}</main>
      </div>
    </div>
  );
}
