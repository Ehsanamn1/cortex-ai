"use client";

import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, Bot, Boxes, BrainCircuit, Check, CheckCircle2, CircleX, Clock3, CreditCard, Database, FileText, Gauge, History, LayoutDashboard,
  ListFilter, LogOut, MessageSquare, Pencil, Plus, Power, RefreshCw, Save, Search, Send, ServerCog, Settings2,
  Sparkles, Users, WalletCards, Workflow, Server, KeyRound, CloudCog
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { OperationsCenter } from "@/components/operations-center";

type Section =
  | "overview" | "users" | "workspaces" | "agents" | "knowledge" | "conversations"
  | "telegram" | "operations" | "site" | "workflows" | "executions" | "audit" | "plugins" | "security"
  | "plans" | "models" | "accounts" | "charges" | "invoices" | "topups" | "systemProviders" | "settings";

const SECTIONS: Array<{ id: Section; label: string; group: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "نمای کلی", group: "اصلی", icon: LayoutDashboard },
  { id: "users", label: "کاربران", group: "مدیریت", icon: Users },
  { id: "workspaces", label: "فضاهای کاری", group: "مدیریت", icon: Boxes },
  { id: "agents", label: "ایجنت‌ها", group: "AI", icon: Bot },
  { id: "knowledge", label: "دانش", group: "AI", icon: Database },
  { id: "conversations", label: "گفتگوها", group: "AI", icon: MessageSquare },
  { id: "telegram", label: "بات‌های تلگرام", group: "اتصال‌ها", icon: Send },
  { id: "operations", label: "عملیات Telegram و دانش", group: "اتصال‌ها", icon: Activity },
  { id: "site", label: "محتوا و ظاهر سایت", group: "سیستم", icon: Sparkles },
  { id: "security", label: "امنیت و دسترسی", group: "سیستم", icon: KeyRound },
  { id: "systemProviders", label: "منابع مدل", group: "زیرساخت", icon: Server },
  { id: "workflows", label: "Workflowها", group: "عملیات", icon: Workflow },
  { id: "executions", label: "Executionها", group: "عملیات", icon: Activity },
  { id: "audit", label: "Audit Log", group: "امنیت", icon: History },
  { id: "plugins", label: "افزونه‌ها", group: "سیستم", icon: Settings2 },
  { id: "plans", label: "پلن‌ها", group: "Billing", icon: CreditCard },
  { id: "models", label: "مدل‌ها و مسیرها", group: "Billing", icon: Gauge },
  { id: "accounts", label: "حساب‌های اعتبار", group: "Billing", icon: WalletCards },
  { id: "charges", label: "شارژهای مصرف", group: "Billing", icon: Activity },
  { id: "invoices", label: "فاکتورها", group: "Billing", icon: FileText },
  { id: "topups", label: "درخواست‌های شارژ", group: "Billing", icon: WalletCards },
  { id: "settings", label: "تنظیمات", group: "سیستم", icon: Settings2 },
];

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: "include", headers: { ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({})) as {
    data?: T;
    error?: { message?: string };
    message?: string;
  };
  if (!res.ok) throw new Error(body.error?.message || body.message || "درخواست ناموفق بود.");
  return body.data ?? (body as T);
}

function Kpi({ title, value, icon: Icon, detail }: { title: string; value: string | number; icon: typeof Bot; detail: string }) {
  return <Card className="rounded-xl border-border bg-card shadow-[0_4px_18px_rgba(15,23,42,.035)]">
    <CardContent className="p-4"><div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{detail}</p></div>
    </div></CardContent>
  </Card>;
}

function DataTable({ section, search }: { section: Section; search: string }) {
  const query = useQuery({
    queryKey: ["cc-resource", section],
    queryFn: () => jsonFetch<{ items: any[] }>("/api/control-center/resources?resource=" + encodeURIComponent(section)),
    enabled: section !== "overview" && !["plans","models","accounts","charges","invoices","settings","systemProviders"].includes(section),
    staleTime: 10_000,
  });
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: ({ resource, id, enabled, status }: { resource: string; id: string; enabled?: boolean; status?: string }) =>
      jsonFetch("/api/control-center/resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource, id, enabled, status }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cc-resource", section] }); toast.success("ذخیره شد"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = useMemo(() => {
    const raw = query.data?.items ?? [];
    if (!search.trim()) return raw;
    const q = search.toLowerCase();
    return raw.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }, [query.data?.items, search]);

  if (query.isPending) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</CardContent></Card>;
  if (query.isError) return <Card className="border-destructive/20"><CardContent className="p-8 text-center text-sm text-destructive">{query.error.message}</CardContent></Card>;

  const cols = section === "users"
    ? [["name","نام"],["email","ایمیل"],["_count.memberships","عضویت"],["_count.conversations","گفتگو"],["createdAt","تاریخ"]]
    : section === "workspaces"
    ? [["name","فضا"],["owner.email","مالک"],["_count.agents","Agent"],["_count.telegramBots","Telegram"],["billingAccount.plan.name","پلن"],["billingAccount.balanceCredits","اعتبار"]]
    : section === "agents"
    ? [["name","ایجنت"],["workspace.name","فضا"],["status","وضعیت"],["providerConfig.model","مدل"],["_count.conversations","گفتگو"]]
    : section === "knowledge"
    ? [["name","منبع"],["agent.name","ایجنت"],["type","نوع"],["status","وضعیت"],["_count.documents","اسناد"]]
    : section === "conversations"
    ? [["title","عنوان"],["agent.name","ایجنت"],["channel","کانال"],["_count.messages","پیام"],["updatedAt","بروزرسانی"]]
    : section === "telegram"
    ? [["name","بات"],["username","username"],["workspace.name","فضا"],["agent.name","ایجنت"],["status","وضعیت"],["_count.users","کاربر"]]
    : section === "workflows"
    ? [["name","Workflow"],["workspace.name","فضا"],["status","وضعیت"],["_count.executions","اجرا"]]
    : section === "executions"
    ? [["id","Execution"],["agent.name","ایجنت"],["triggerType","Trigger"],["status","وضعیت"],["_count.steps","Step"]]
    : section === "audit"
    ? [["action","Action"],["entityType","Entity"],["workspace.name","فضا"],["user.email","کاربر"],["createdAt","زمان"]]
    : [["name","نام"],["key","Key"],["version","نسخه"],["enabled","فعال"]];

  const valueAt = (row: any, key: string) => key.split(".").reduce((v, part) => v?.[part], row);
  return <Card className="overflow-hidden border-border">
    <CardHeader className="border-b border-border bg-muted/20"><CardTitle className="text-sm">{SECTIONS.find((s) => s.id === section)?.label}</CardTitle></CardHeader>
    <CardContent className="overflow-x-auto p-0">
      <table className="w-full min-w-[760px] text-right text-xs">
        <thead className="bg-muted/30 text-muted-foreground"><tr>{cols.map(([k,l]) => <th key={k} className="whitespace-nowrap px-4 py-3 font-medium">{l}</th>)}<th className="px-4 py-3">عملیات</th></tr></thead>
        <tbody className="divide-y divide-border">
          {items.map((row) => <tr key={row.id} className="hover:bg-muted/20">
            {cols.map(([k]) => <td key={k} className="max-w-[240px] truncate px-4 py-3">
              {typeof valueAt(row,k) === "boolean" ? (valueAt(row,k) ? "بله" : "خیر") : valueAt(row,k) instanceof Object ? JSON.stringify(valueAt(row,k)) : String(valueAt(row,k) ?? "—")}
            </td>)}
            <td className="px-4 py-3">
              {["agents","plugins"].includes(section) && <Button size="sm" variant="ghost" onClick={() => {
                if (section === "agents") toggle.mutate({ resource: "agents", id: row.id, status: row.status === "active" ? "paused" : "active" });
                else toggle.mutate({ resource: "plugins", id: row.id, enabled: !row.enabled });
              }}><Power className="size-4" /></Button>}
            </td>
          </tr>)}
          {!items.length && <tr><td colSpan={cols.length+1} className="px-4 py-12 text-center text-muted-foreground">داده‌ای پیدا نشد.</td></tr>}
        </tbody>
      </table>
    </CardContent>
  </Card>;
}

function BillingPanel({ section }: { section: Section }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cc-billing"], queryFn: () => jsonFetch<any>("/api/control-center/billing"), staleTime: 5_000 });
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const patch = useMutation({
    mutationFn: ({ action, id, body }: { action: string; id: string; body: Record<string, unknown> }) =>
      jsonFetch("/api/control-center/billing", { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action, id, ...body }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cc-billing"] }); toast.success("Billing ذخیره شد"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const create = useMutation({
    mutationFn: ({ action, body }: { action: string; body: Record<string, unknown> }) =>
      jsonFetch("/api/control-center/billing", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action, ...body }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cc-billing"] }); toast.success("ایجاد شد"); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isPending) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">در حال بارگذاری Billing…</CardContent></Card>;
  if (q.isError) return <Card><CardContent className="p-8 text-center text-sm text-destructive">{q.error.message}</CardContent></Card>;

  if (section === "plans") return <div className="space-y-4">
    <PlanCreate onSave={(body) => create.mutate({ action: "create_plan", body })}/>
    <div className="grid gap-4 xl:grid-cols-2">{(q.data.plans ?? []).map((plan: any) => <Card key={plan.id} className="border-border">
    <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-sm">{plan.name}</CardTitle><Button size="sm" variant="ghost" onClick={() => setEditingPlan(editingPlan === plan.id ? null : plan.id)}><Pencil className="size-4"/></Button></CardHeader>
    <CardContent>{editingPlan === plan.id ? <PlanEditor plan={plan} onSave={(body) => patch.mutate({action:"update_plan",id:plan.id,body})}/> :
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div><span className="text-muted-foreground">Key</span><p className="font-mono">{plan.key}</p></div>
        <div><span className="text-muted-foreground">قیمت</span><p className="font-semibold">{Number(plan.priceToman).toLocaleString("fa-IR")} تومان</p></div>
        <div><span className="text-muted-foreground">اعتبار ماهانه</span><p className="font-semibold">{Number(plan.monthlyCredits).toLocaleString("fa-IR")}</p></div>
        <div><span className="text-muted-foreground">Overage</span><p>{Number(plan.overageCreditPriceToman).toLocaleString("fa-IR")}</p></div>
      </div>}</CardContent>
  </Card>)}</div></div>;

  if (section === "models") return <div className="space-y-4">
    <ModelCreate providers={q.data.systemProviders ?? []} onSave={(body) => create.mutate({ action: "create_model", body })}/>
    <div className="grid gap-3">{(q.data.models ?? []).map((model: any) => <Card key={model.id} className="border-border">
    <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{model.displayName}</p>{model.trialDefault && <span className="rounded-full bg-[#e8f0ff] px-2 py-1 text-[9px] font-bold text-[#36558f]">Trial Default</span>}{model.systemProvider?.displayName && <span className="rounded-full border px-2 py-1 text-[9px] text-muted-foreground">{model.systemProvider.displayName}</span>}</div><p className="mt-1 text-[11px] text-muted-foreground">{model.provider} · <code>{model.modelId}</code></p></div>
      <div className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4 lg:w-[440px]"><span>Input <b>{"$" + model.inputUsdPer1M}</b></span><span>Output <b>{"$" + model.outputUsdPer1M}</b></span><span>Tier <b>{model.qualityTier}</b></span><span>Active <b>{model.active?"Yes":"No"}</b></span></div>
      <Button size="sm" variant="ghost" onClick={() => setEditingModel(editingModel === model.id ? null : model.id)}><Pencil className="size-4"/></Button>
      {editingModel === model.id && <div className="w-full lg:basis-full"><ModelEditor model={model} providers={q.data.systemProviders ?? []} onSave={(body) => patch.mutate({action:"update_model",id:model.id,body})}/></div>}
    </CardContent>
  </Card>)}</div>
    <ModelAccessMatrix plans={q.data.plans ?? []} models={q.data.models ?? []} onSave={(body) => patch.mutate({action:"set_access",id:"access",body})}/>
  </div>;

  if (section === "accounts") return <div className="grid gap-3">{(q.data.accounts ?? []).map((account:any) => <AccountEditor key={account.id} account={account} plans={q.data.plans ?? []} onSave={(body) => patch.mutate({action:"update_account",id:account.id,body})}/>)}</div>;

  if (section === "topups") return <TopUpRequestsPanel />;

  if (section === "charges") return <Card className="overflow-hidden"><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[900px] text-right text-xs"><thead className="bg-muted/30"><tr>{["فضا","Provider","Model","Credits","Status","زمان"].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y">{(q.data.recentCharges??[]).map((x:any)=><tr key={x.id}><td className="px-4 py-3">{x.workspace?.name}</td><td className="px-4 py-3">{x.provider}</td><td className="px-4 py-3 font-mono">{x.model}</td><td className="px-4 py-3 font-semibold">{Number(x.chargedCredits).toLocaleString("fa-IR")}</td><td className="px-4 py-3">{x.status}</td><td className="px-4 py-3">{new Date(x.createdAt).toLocaleString("fa-IR")}</td></tr>)}</tbody></table></CardContent></Card>;

  return <Card className="overflow-hidden"><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[900px] text-right text-xs"><thead className="bg-muted/30"><tr>{["شماره فاکتور","فضا","وضعیت","جمع","ایجاد"].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y">{(q.data.invoices??[]).map((x:any)=><tr key={x.id}><td className="px-4 py-3 font-mono">{x.invoiceNumber}</td><td className="px-4 py-3">{x.workspace?.name}</td><td className="px-4 py-3">{x.status}</td><td className="px-4 py-3">{Number(x.totalToman).toLocaleString("fa-IR")} تومان</td><td className="px-4 py-3">{new Date(x.createdAt).toLocaleString("fa-IR")}</td></tr>)}</tbody></table></CardContent></Card>;
}

function TopUpRequestsPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey:["cc-topups"], queryFn:()=>jsonFetch<any>("/api/control-center/topups"), staleTime:5_000 });
  const review = useMutation({
    mutationFn: ({requestId, action}:{requestId:string;action:"approve"|"reject"}) =>
      jsonFetch("/api/control-center/topups",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId,action})}),
    onSuccess:(_,vars)=>{qc.invalidateQueries({queryKey:["cc-topups"]});qc.invalidateQueries({queryKey:["cc-summary"]});toast.success(vars.action==="approve"?"شارژ تأیید و به موجودی اضافه شد.":"درخواست شارژ رد شد.");},
    onError:(e:Error)=>toast.error(e.message),
  });
  if(q.isPending) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">در حال بارگذاری درخواست‌های شارژ…</CardContent></Card>;
  if(q.isError) return <Card><CardContent className="p-8 text-center text-sm text-destructive">{q.error.message}</CardContent></Card>;
  const rows=q.data?.requests??[];
  return <Card className="overflow-hidden border-border">
    <CardHeader className="border-b bg-muted/20"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-sm">درخواست‌های شارژ اعتبار</CardTitle><p className="mt-1 text-[10px] text-muted-foreground">تأیید این‌جا واقعاً موجودی Workspace را افزایش می‌دهد و Ledger ثبت می‌کند.</p></div><span className="rounded-full border bg-background px-3 py-1 text-[10px]">{Number(rows.filter((x:any)=>x.status==="pending").length).toLocaleString("fa-IR")} در انتظار</span></div></CardHeader>
    <CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[1050px] text-right text-xs"><thead className="bg-muted/30"><tr>{["فضا","کاربر","بسته","اعتبار","مبلغ","وضعیت","ثبت","بررسی","عملیات"].map(x=><th key={x} className="whitespace-nowrap px-4 py-3">{x}</th>)}</tr></thead>
      <tbody className="divide-y">
        {rows.map((x:any)=><tr key={x.id} className="hover:bg-muted/20">
          <td className="px-4 py-3 font-medium">{x.workspace?.name??"—"}</td>
          <td className="px-4 py-3"><div>{x.user?.name??"—"}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{x.user?.email??"—"}</div></td>
          <td className="px-4 py-3 font-mono">{x.packageKey}</td>
          <td className="px-4 py-3 font-semibold">{Number(x.credits).toLocaleString("fa-IR")}</td>
          <td className="px-4 py-3">{Number(x.amountToman).toLocaleString("fa-IR")} تومان</td>
          <td className="px-4 py-3">{x.status==="pending"?<span className="inline-flex items-center gap-1 text-amber-600"><Clock3 className="size-3.5"/>در انتظار</span>:x.status==="approved"?<span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="size-3.5"/>تأیید</span>:<span className="inline-flex items-center gap-1 text-rose-600"><CircleX className="size-3.5"/>رد</span>}</td>
          <td className="px-4 py-3 whitespace-nowrap">{new Date(x.createdAt).toLocaleString("fa-IR")}</td>
          <td className="px-4 py-3 whitespace-nowrap">{x.reviewedAt?new Date(x.reviewedAt).toLocaleString("fa-IR"):"—"}</td>
          <td className="px-4 py-3">{x.status==="pending"&&<div className="flex items-center gap-1"><Button size="sm" onClick={()=>review.mutate({requestId:x.id,action:"approve"})} disabled={review.isPending}><CheckCircle2 className="size-3.5"/>تأیید</Button><Button size="sm" variant="outline" onClick={()=>review.mutate({requestId:x.id,action:"reject"})} disabled={review.isPending}><CircleX className="size-3.5"/>رد</Button></div>}</td>
        </tr>)}
        {!rows.length&&<tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">درخواست شارژی ثبت نشده است.</td></tr>}
      </tbody>
    </table></CardContent>
  </Card>;
}

function PlanCreate({onSave}:{onSave:(body:any)=>void}) {
  const [v,setV]=useState({key:"",name:"",priceToman:"0",monthlyCredits:"0",overageCreditPriceToman:"0",sortOrder:"10"});
  return <Card className="border-border"><CardHeader><CardTitle className="text-sm">ساخت پلن جدید</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
    <Input placeholder="key" value={v.key} onChange={e=>setV({...v,key:e.target.value})}/>
    <Input placeholder="نام" value={v.name} onChange={e=>setV({...v,name:e.target.value})}/>
    <Input type="number" placeholder="قیمت تومان" value={v.priceToman} onChange={e=>setV({...v,priceToman:e.target.value})}/>
    <Input type="number" placeholder="Credits ماهانه" value={v.monthlyCredits} onChange={e=>setV({...v,monthlyCredits:e.target.value})}/>
    <Input type="number" placeholder="Overage / credit" value={v.overageCreditPriceToman} onChange={e=>setV({...v,overageCreditPriceToman:e.target.value})}/>
    <Button onClick={()=>onSave({key:v.key,name:v.name,priceToman:Number(v.priceToman),monthlyCredits:Number(v.monthlyCredits),overageCreditPriceToman:Number(v.overageCreditPriceToman),sortOrder:Number(v.sortOrder)})}><Save/>ساخت پلن</Button>
  </CardContent></Card>;
}

function ModelCreate({providers,onSave}:{providers:any[];onSave:(body:any)=>void}) {
  const [v,setV]=useState({provider:"",modelId:"",displayName:"",routeKey:"",inputUsdPer1M:"0",outputUsdPer1M:"0",systemProviderId:"",trialEnabled:false,trialDefault:false});
  return <Card className="border-border"><CardHeader><CardTitle className="text-sm">ثبت مدل و مسیر Runtime</CardTitle><p className="text-[10px] text-muted-foreground">این مدل از Provider انتخاب‌شده تغذیه می‌شود. کاربر نهایی فقط نام Cortex مدل را می‌بیند.</p></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <Input placeholder="Route Key مثل cortex-fast" value={v.routeKey} onChange={e=>setV({...v,routeKey:e.target.value})}/>
    <Input placeholder="Provider label" value={v.provider} onChange={e=>setV({...v,provider:e.target.value})}/>
    <Input placeholder="Model ID" dir="ltr" value={v.modelId} onChange={e=>setV({...v,modelId:e.target.value})}/>
    <Input placeholder="Display name" value={v.displayName} onChange={e=>setV({...v,displayName:e.target.value})}/>
    <select className="h-9 rounded-md border border-input bg-background px-3 text-xs" value={v.systemProviderId} onChange={e=>setV({...v,systemProviderId:e.target.value})}><option value="">انتخاب Provider سراسری</option>{providers.map(p=><option key={p.id} value={p.id}>{p.displayName} · {p.providerName}</option>)}</select>
    <Input type="number" step="0.000001" placeholder="Input USD/1M" value={v.inputUsdPer1M} onChange={e=>setV({...v,inputUsdPer1M:e.target.value})}/>
    <Input type="number" step="0.000001" placeholder="Output USD/1M" value={v.outputUsdPer1M} onChange={e=>setV({...v,outputUsdPer1M:e.target.value})}/>
    <div className="flex items-center justify-between rounded-xl border p-3"><span className="text-[10px] font-semibold">مجاز در Trial</span><Switch checked={v.trialEnabled} onCheckedChange={x=>setV({...v,trialEnabled:x})}/></div>
    <div className="flex items-center justify-between rounded-xl border p-3"><span className="text-[10px] font-semibold">Default Trial</span><Switch checked={v.trialDefault} onCheckedChange={x=>setV({...v,trialDefault:x,trialEnabled:x || v.trialEnabled})}/></div>
    <Button className="sm:col-span-2 xl:col-span-4" onClick={()=>onSave({provider:v.provider,modelId:v.modelId,displayName:v.displayName,routeKey:v.routeKey,systemProviderId:v.systemProviderId || undefined,inputUsdPer1M:Number(v.inputUsdPer1M),outputUsdPer1M:Number(v.outputUsdPer1M),trialEnabled:v.trialEnabled,trialDefault:v.trialDefault})}><Save/>ثبت مدل و Route</Button>
  </CardContent></Card>;
}

function PlanEditor({plan,onSave}:{plan:any;onSave:(body:any)=>void}) {
  const [v,setV]=useState({...plan});
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <Input value={v.name} onChange={e=>setV({...v,name:e.target.value})} placeholder="نام"/>
    <Input type="number" value={v.priceToman} onChange={e=>setV({...v,priceToman:e.target.value})} placeholder="قیمت تومان"/>
    <Input type="number" value={v.monthlyCredits} onChange={e=>setV({...v,monthlyCredits:e.target.value})} placeholder="اعتبار ماهانه"/>
    <Input type="number" value={v.overageCreditPriceToman} onChange={e=>setV({...v,overageCreditPriceToman:e.target.value})} placeholder="قیمت هر اعتبار مازاد"/>
    <Input type="number" value={v.sortOrder ?? 0} onChange={e=>setV({...v,sortOrder:e.target.value})} placeholder="ترتیب"/>
    <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3"><span className="text-xs font-semibold">فعال</span><Switch checked={v.active !== false} onCheckedChange={x=>setV({...v,active:x})}/></div>
    <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3"><span className="text-xs font-semibold">مصرف مازاد</span><Switch checked={Boolean(v.overageEnabled)} onCheckedChange={x=>setV({...v,overageEnabled:x})}/></div>
    <Button className="sm:col-span-2 lg:col-span-3 sm:w-fit" onClick={()=>onSave({
      name:v.name,
      priceToman:Number(v.priceToman),
      monthlyCredits:Number(v.monthlyCredits),
      overageCreditPriceToman:Number(v.overageCreditPriceToman),
      sortOrder:Number(v.sortOrder ?? 0),
      active:Boolean(v.active),
      overageEnabled:Boolean(v.overageEnabled),
    })}><Save/>ذخیره پلن</Button>
  </div>;
}

function ModelEditor({model,providers,onSave}:{model:any;providers:any[];onSave:(body:any)=>void}) {
  const [v,setV]=useState({...model,systemProviderId:model.systemProviderId ?? model.systemProvider?.id ?? "",routeKey:model.routeKey ?? "",trialEnabled:Boolean(model.trialEnabled),trialDefault:Boolean(model.trialDefault)});
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <Input value={v.routeKey} onChange={e=>setV({...v,routeKey:e.target.value})} placeholder="Route Key"/>
    <Input value={v.displayName} onChange={e=>setV({...v,displayName:e.target.value})} placeholder="نمایش"/>
    <Input type="number" step="0.000001" value={v.inputUsdPer1M} onChange={e=>setV({...v,inputUsdPer1M:e.target.value})} placeholder="Input USD/1M"/>
    <Input type="number" step="0.000001" value={v.outputUsdPer1M} onChange={e=>setV({...v,outputUsdPer1M:e.target.value})} placeholder="Output USD/1M"/>
    <Input value={v.qualityTier} onChange={e=>setV({...v,qualityTier:e.target.value})} placeholder="Quality tier"/>
    <select className="h-9 rounded-md border border-input bg-background px-3 text-xs" value={v.systemProviderId} onChange={e=>setV({...v,systemProviderId:e.target.value})}><option value="">بدون Provider Registry</option>{providers.map(p=><option key={p.id} value={p.id}>{p.displayName}</option>)}</select>
    <div className="flex items-center justify-between rounded-xl border p-3"><span className="text-[10px] font-semibold">Trial</span><Switch checked={v.trialEnabled} onCheckedChange={x=>setV({...v,trialEnabled:x})}/></div>
    <div className="flex items-center justify-between rounded-xl border p-3"><span className="text-[10px] font-semibold">Default Trial</span><Switch checked={v.trialDefault} onCheckedChange={x=>setV({...v,trialDefault:x,trialEnabled:x || v.trialEnabled})}/></div>
    <Button onClick={()=>onSave({displayName:v.displayName,inputUsdPer1M:Number(v.inputUsdPer1M),outputUsdPer1M:Number(v.outputUsdPer1M),qualityTier:v.qualityTier,routeKey:v.routeKey,systemProviderId:v.systemProviderId || null,trialEnabled:v.trialEnabled,trialDefault:v.trialDefault})}><Save/>ذخیره مدل</Button>
  </div>;
}

function AccountEditor({account,plans,onSave}:{account:any;plans:any[];onSave:(body:any)=>void}) {
  const [adjust,setAdjust]=useState(""); const [enabled,setEnabled]=useState(Boolean(account.enforcementEnabled)); const [planId,setPlanId]=useState(account.planId);
  return <Card className="border-border"><CardContent className="grid gap-3 p-4 lg:grid-cols-[1.3fr_.7fr_.7fr_auto] lg:items-center"><div><p className="text-sm font-semibold">{account.workspace?.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{account.workspace?.owner?.email}</p></div><select className="h-9 rounded-md border border-input bg-background px-3 text-xs" value={planId} onChange={e=>setPlanId(e.target.value)}>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><div><p className="text-xs font-semibold">{Number(account.balanceCredits).toLocaleString("fa-IR")} credits</p><div className="mt-1 flex items-center gap-2"><Switch checked={enabled} onCheckedChange={setEnabled}/><span className="text-[10px] text-muted-foreground">enforce</span></div></div><div className="flex items-center gap-2"><Input className="w-32" type="number" value={adjust} onChange={e=>setAdjust(e.target.value)} placeholder="± credits"/><Button size="sm" onClick={()=>onSave({planId,enforcementEnabled:enabled,creditAdjustment:adjust ? Number(adjust) : undefined})}><Save/></Button></div></CardContent></Card>;
}

export function ControlCenterV2() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  }));
  return <QueryClientProvider client={queryClient}><ControlCenterRuntime /></QueryClientProvider>;
}

function ControlCenterRuntime() {
  const [section,setSection]=useState<Section>("overview"); const [search,setSearch]=useState("");
  const qc=useQueryClient();
  const session=useQuery<{username:string}>({queryKey:["cc-auth"],queryFn:()=>jsonFetch("/api/admin/auth/me"),retry:false});
  const summary=useQuery<any>({queryKey:["cc-summary"],queryFn:()=>jsonFetch("/api/control-center"),enabled:session.isSuccess,staleTime:10_000});
  const logout=useMutation({mutationFn:()=>fetch("/api/admin/auth/logout",{method:"POST"}),onSuccess:()=>{qc.clear();window.location.reload();}});
  if(session.isPending) return <div className="min-h-screen bg-[#f6f7fb] p-8"><div className="mx-auto max-w-7xl rounded-xl bg-white p-12 text-center">در حال آماده‌سازی پیشخوان…</div></div>;
  if(session.isError) return <div className="grid min-h-screen place-items-center bg-[#0b1016] p-6" dir="rtl"><section className="w-full max-w-lg border border-[#2b3746] bg-[#111820] p-8 text-center text-[#e8edf4] shadow-[0_28px_90px_rgba(0,0,0,.35)]"><div className="mx-auto grid size-12 place-items-center bg-[#74a0ff]/10 text-[#91b2ff]"><KeyRound className="size-5" /></div><h1 className="mt-4 text-lg font-black">نشست مدیریت معتبر نیست</h1><p className="mt-2 text-xs leading-6 text-[#8f9a89]">نشست پنل منقضی یا نامعتبر شده است. برای ادامه دوباره وارد پنل شو.</p><Button className="mt-5" onClick={()=>window.location.assign("/admin/login")}>ورود مجدد</Button></section></div>;
  const groups=[...new Set(SECTIONS.map(x=>x.group))]; const m=summary.data?.metrics??{}; const activeSection=SECTIONS.find(x=>x.id===section)!;
  return <div className="cortex-control-center min-h-screen bg-[#0b1016] text-[#e7edf5]" dir="rtl"><div className="flex min-h-screen">
    <aside className="hidden w-[258px] shrink-0 border-l border-[#263021] bg-[#111611] lg:flex lg:flex-col">
      <div className="border-b border-[#252f3c] px-5 py-6">
        <p className="text-[9px] font-bold tracking-[.26em] text-[#74a0ff]">CORTEX / OPERATOR</p>
        <div className="mt-2 text-xl font-black tracking-tight text-[#eef3f8]">پیشخوان عملیات</div>
        <p className="mt-2 max-w-[190px] text-[10px] leading-6 text-[#78879a]">محیط خصوصی مالک سیستم برای کنترل مدل‌ها، منابع، پلن‌ها، اعتبار و عملیات.</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">{groups.map(group=><div key={group} className="mb-6"><p className="px-2 pb-2 text-[8px] font-bold tracking-[.24em] text-[#6e7d90]">{group.toUpperCase()}</p><div className="space-y-1">{SECTIONS.filter(s=>s.group===group).map(s=><button key={s.id} type="button" onClick={()=>{setSection(s.id);setSearch("");}} className={cn("group relative flex w-full items-center gap-2 border px-3 py-2.5 text-xs font-semibold transition",section===s.id?"border-[#74a0ff]/30 bg-[#74a0ff]/10 text-[#b7ccff]":"border-transparent text-[#94a2b4] hover:border-[#252f3c] hover:bg-[#151d27] hover:text-[#dce5ef]")}><span className={cn("absolute start-0 top-1/2 h-5 w-[2px] -translate-y-1/2 transition",section===s.id?"bg-[#74a0ff]":"bg-transparent")}/><s.icon className="size-4 shrink-0"/><span>{s.label}</span></button>)}</div></div>)}</nav>
      <div className="border-t border-[#252f3c] p-4"><div className="flex items-center gap-2 border border-[#27323f] bg-[#151d27] p-2.5"><span className="flex size-8 items-center justify-center bg-[#74a0ff] text-[10px] font-black text-[#1b210f]">CX</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#dfe4d7]">مالک سیستم</p><p className="text-[9px] text-[#75859a]">Private operator</p></div><Button variant="ghost" size="icon" className="text-[#8797aa] hover:bg-[#1b2532] hover:text-white" onClick={()=>logout.mutate()}><LogOut className="size-4"/></Button></div></div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 border-b border-[#263021] bg-[#0f130f]/95 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-4 lg:px-7">
          <div className="min-w-0 flex-1"><p className="text-[8px] font-bold tracking-[.26em] text-[#8595a8]">OPERATOR CONSOLE</p><h1 className="mt-1 truncate text-xl font-black text-[#eef0e6]">{activeSection.label}</h1></div>
          <div className="hidden w-[280px] items-center gap-2 border border-[#2d3829] bg-[#111820] px-3 py-2 md:flex"><Search className="size-4 text-[#73849a]"/><Input value={search} onChange={e=>setSearch(e.target.value)} className="h-5 border-0 bg-transparent p-0 text-xs text-[#e7edf5] shadow-none placeholder:text-[#718096] focus-visible:ring-0" placeholder="جستجو در سیستم…"/></div>
          <Button variant="outline" size="icon" className="border-[#32402c] bg-[#151a15] text-[#aab3a3] hover:bg-[#1b2532] hover:text-white" onClick={()=>{qc.invalidateQueries();toast.success("داده‌ها تازه شد")}}><RefreshCw className="size-4"/></Button>
        </div>
      </header>
      <div className="flex gap-1 overflow-x-auto border-b border-[#263021] bg-[#111611] px-3 py-2 lg:hidden">
        {SECTIONS.map(s=><button key={s.id} type="button" onClick={()=>setSection(s.id)} className={cn("whitespace-nowrap border px-3 py-2 text-[10px] font-semibold transition",section===s.id?"border-[#74a0ff]/30 bg-[#74a0ff]/10 text-[#b7ccff]":"border-transparent text-[#9ba9ba]")}>{s.label}</button>)}
      </div>
      <main className="mx-auto max-w-[1460px] space-y-6 p-4 lg:p-8">
        {section==="overview"?<Overview summary={summary.data}/>:section==="settings"?<SiteControlPanel/>:section==="site"?<SiteControlPanel/>:section==="security"?<SecurityPanel onLogout={()=>logout.mutate()}/>:section==="systemProviders"?<SystemProvidersPanel/>:section==="operations"?<OperationsCenter/>:["plans","models","accounts","charges","invoices","topups"].includes(section)?<BillingPanel section={section}/>:<DataTable section={section} search={search}/>} 
      </main>
    </div>
  </div></div>;
}

function Overview({summary}:{summary:any}) {
  const m=summary?.metrics??{}; const f=summary?.financial?.last30Days??{};
  return <div className="space-y-5"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi title="کاربران" value={m.users??0} icon={Users} detail="کل حساب‌ها"/><Kpi title="فضاهای کاری" value={m.workspaces??0} icon={Boxes} detail="Workspace"/><Kpi title="ایجنت‌ها" value={m.agents??0} icon={Bot} detail="Agent"/><Kpi title="بات‌ها" value={m.bots??0} icon={Send} detail="Telegram"/></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi title="گفتگوها" value={m.conversations??0} icon={MessageSquare} detail="Conversation"/><Kpi title="پیام‌ها" value={m.messages??0} icon={MessageSquare} detail="Message"/><Kpi title="Usage Events" value={m.events??0} icon={Activity} detail="ثبت‌شده"/><Kpi title="Audit Logs" value={m.logs??0} icon={History} detail="رخداد"/></section>
    <section className="grid gap-4 xl:grid-cols-3"><Card className="border-border"><CardHeader><CardTitle className="text-sm">Billing وضعیت</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex justify-between text-xs"><span>حساب‌های اعتباری</span><b>{Number(summary?.financial?.billingAccounts??0).toLocaleString("fa-IR")}</b></div><div className="flex justify-between text-xs"><span>Subscription فعال</span><b>{Number(summary?.financial?.activeSubscriptions??0).toLocaleString("fa-IR")}</b></div><div className="flex justify-between text-xs"><span>Credits مصرف‌شده</span><b>{Number(f.creditsConsumed??0).toLocaleString("fa-IR")}</b></div><p className="rounded-lg bg-amber-50 p-3 text-[10px] leading-5 text-amber-800">درآمد نقدی و سود تا اتصال درگاه واقعی محاسبه نمی‌شوند.</p></CardContent></Card>
      <Card className="border-border xl:col-span-2"><CardHeader><CardTitle className="text-sm">ایجنت‌های اخیر</CardTitle></CardHeader><CardContent className="divide-y">{(summary?.recentAgents??[]).slice(0,8).map((a:any)=><div key={a.id} className="flex items-center gap-3 py-3"><span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot className="size-4"/></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{a.name}</p><p className="text-[10px] text-muted-foreground">{a.workspace.name} · {a.status}</p></div><span className="text-[10px] text-muted-foreground">{new Date(a.createdAt).toLocaleDateString("fa-IR")}</span></div>)}</CardContent></Card></section>
  </div>;
}

function ModelAccessMatrix({plans,models,onSave}:{plans:any[];models:any[];onSave:(body:any)=>void}) {
  const [selectedPlan,setSelectedPlan]=useState(plans[0]?.id ?? "");
  const plan=plans.find((p:any)=>p.id===selectedPlan);
  const accessRows = (plan?.modelAccess ?? []) as Array<{ modelCatalogId: string; enabled?: boolean; creditMultiplierBps?: number }>;
  const accessByModel = new Map<string, { modelCatalogId: string; enabled?: boolean; creditMultiplierBps?: number }>(accessRows.map((x) => [x.modelCatalogId, x]));
  return <Card className="border-border overflow-hidden">
    <CardHeader><CardTitle className="text-sm">دسترسی مدل‌ها در هر پلن</CardTitle><p className="text-[10px] text-muted-foreground">فعال‌سازی و ضریب مصرف هر مدل برای هر پلن از همین‌جا کنترل می‌شود.</p></CardHeader>
    <CardContent className="space-y-3">
      <select className="h-9 rounded-md border border-input bg-background px-3 text-xs" value={selectedPlan} onChange={e=>setSelectedPlan(e.target.value)}>
        {plans.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-right text-xs"><thead className="bg-muted/30"><tr><th className="px-3 py-3">مدل</th><th className="px-3 py-3">Provider</th><th className="px-3 py-3">فعال</th><th className="px-3 py-3">Multiplier BPS</th><th className="px-3 py-3">ثبت</th></tr></thead>
        <tbody className="divide-y">{models.map((m:any)=>{const current=accessByModel.get(m.id); const enabled=current?.enabled ?? false; const mult=current?.creditMultiplierBps ?? 200; return <AccessRow key={m.id} model={m} enabled={enabled} multiplier={mult} onSave={(b:any)=>onSave({planId:selectedPlan,modelCatalogId:m.id,enabled:b.enabled,creditMultiplierBps:b.multiplier})}/>})}</tbody>
      </table></div>
    </CardContent>
  </Card>;
}
function AccessRow({model,enabled,multiplier,onSave}:{model:any;enabled:boolean;multiplier:number;onSave:(b:any)=>void}) {
  const [e,setE]=useState(enabled); const [m,setM]=useState(String(multiplier));
  return <tr><td className="px-3 py-3 font-medium">{model.displayName}</td><td className="px-3 py-3">{model.provider}</td><td className="px-3 py-3"><Switch checked={e} onCheckedChange={setE}/></td><td className="px-3 py-3"><Input className="w-32" type="number" value={m} onChange={x=>setM(x.target.value)}/></td><td className="px-3 py-3"><Button size="sm" onClick={()=>onSave({enabled:e,multiplier:Number(m)})}><Save/></Button></td></tr>;
}
function SystemProvidersPanel() {
  const qc = useQueryClient();
  const providersQ = useQuery({
    queryKey: ["cc-system-providers"],
    queryFn: () => jsonFetch<{ providers: any[]; trial: any }>("/api/control-center/providers"),
    staleTime: 5_000,
  });
  const billingQ = useQuery({
    queryKey: ["cc-billing"],
    queryFn: () => jsonFetch<any>("/api/control-center/billing"),
    staleTime: 10_000,
  });
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    key: "", displayName: "", providerName: "", protocol: "openai-compatible",
    authMode: "bearer", baseUrl: "https://api.openai.com/v1", apiKey: "",
    enabled: true, isTrialProvider: false,
  });
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [modelDraft, setModelDraft] = useState({ modelId: "", displayName: "", inputTomanPer1M: "0", outputTomanPer1M: "0" });
  const [trialProviderId, setTrialProviderId] = useState("");
  const [trialModelId, setTrialModelId] = useState("");

  const providerAction = useMutation({
    mutationFn: async (args: { method: "POST" | "PATCH" | "DELETE"; body?: Record<string, unknown>; id?: string }) => {
      const response = await fetch(args.method === "DELETE" && args.id
        ? "/api/control-center/providers?id=" + encodeURIComponent(args.id)
        : "/api/control-center/providers", {
        method: args.method,
        credentials: "include",
        headers: args.method === "DELETE" ? undefined : { "content-type": "application/json" },
        body: args.method === "DELETE" ? undefined : JSON.stringify(args.body ?? {}),
      });
      const payload = await response.json().catch(() => ({})) as any;
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : payload.error?.message || payload.message || "عملیات Provider ناموفق بود.");
      return payload.data ?? payload;
    },
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ["cc-system-providers"] });
      await qc.invalidateQueries({ queryKey: ["cc-billing"] });
      if (vars.method === "DELETE") toast.success("Provider حذف شد.");
      else toast.success("Provider ذخیره شد.");
      setEditing(null);
      setDiscovered([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const trialAction = useMutation({
    mutationFn: ({ providerId, modelCatalogId }: { providerId: string; modelCatalogId: string }) =>
      jsonFetch("/api/control-center/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "configure_trial", providerId, modelCatalogId }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cc-system-providers"] });
      await qc.invalidateQueries({ queryKey: ["cc-billing"] });
      toast.success("مسیر Trial تست و فعال شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const modelCreate = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      jsonFetch("/api/control-center/billing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create_model", ...body }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cc-billing"] });
      await qc.invalidateQueries({ queryKey: ["cc-system-providers"] });
      toast.success("مدل به Model Catalog اضافه شد.");
      setModelDraft({ modelId: "", displayName: "", inputTomanPer1M: "0", outputTomanPer1M: "0" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setDiscovered([]);
    setModelDraft({ modelId: "", displayName: "", inputTomanPer1M: "0", outputTomanPer1M: "0" });
    setForm({ key: "", displayName: "", providerName: "", protocol: "openai-compatible", authMode: "bearer", baseUrl: "https://api.openai.com/v1", apiKey: "", enabled: true, isTrialProvider: false });
  };

  const openEdit = (provider: any) => {
    setEditing(provider);
    setDiscovered([]);
    setModelDraft({ modelId: provider.testModelId ?? "", displayName: provider.testModelId ?? "", inputTomanPer1M: "0", outputTomanPer1M: "0" });
    setForm({
      key: provider.key ?? "",
      displayName: provider.displayName ?? "",
      providerName: provider.providerName ?? "",
      protocol: provider.protocol ?? "openai-compatible",
      authMode: provider.authMode ?? "bearer",
      baseUrl: provider.baseUrl ?? "",
      apiKey: "",
      enabled: provider.enabled !== false,
      isTrialProvider: provider.isTrialProvider === true,
    });
  };

  const changeProtocol = (protocol: string) => {
    const defaults: Record<string, { baseUrl: string; authMode: string; providerName: string }> = {
      "openai-compatible": { baseUrl: "https://api.openai.com/v1", authMode: "bearer", providerName: "OpenAI Compatible" },
      "openrouter": { baseUrl: "https://openrouter.ai/api/v1", authMode: "bearer", providerName: "OpenRouter" },
      "anthropic": { baseUrl: "https://api.anthropic.com", authMode: "x-api-key", providerName: "Anthropic" },
      "gemini": { baseUrl: "https://generativelanguage.googleapis.com", authMode: "x-api-key", providerName: "Google Gemini" },
    };
    const d = defaults[protocol] ?? defaults["openai-compatible"];
    setForm((v) => ({ ...v, protocol, baseUrl: v.baseUrl && v.baseUrl !== "https://api.openai.com/v1" && v.baseUrl !== "https://openrouter.ai/api/v1" && v.baseUrl !== "https://api.anthropic.com" && v.baseUrl !== "https://generativelanguage.googleapis.com" ? v.baseUrl : d.baseUrl, authMode: d.authMode, providerName: v.providerName || d.providerName }));
  };

  const save = () => {
    const body = { ...form, ...(editing ? { id: editing.id } : {}) };
    providerAction.mutate({ method: editing ? "PATCH" : "POST", body });
  };

  const testProvider = async () => {
    const provider = editing;
    if (!provider) return toast.error("ابتدا Provider را ذخیره و انتخاب کن.");
    try {
      const result = await jsonFetch<any>("/api/control-center/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: { action: "test", providerId: provider.id, modelId: modelDraft.modelId.trim() || provider.testModelId || "" },
      } as any);
      if (result.health?.ok) toast.success("اتصال سالم است · " + Number(result.health.latencyMs ?? 0).toLocaleString("fa-IR") + "ms");
      else toast.error(result.health?.error || "اتصال سالم نبود.");
      await qc.invalidateQueries({ queryKey: ["cc-system-providers"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const discoverModels = async () => {
    if (!editing) return toast.error("ابتدا Provider را ذخیره و انتخاب کن.");
    try {
      const result = await jsonFetch<any>("/api/control-center/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "discover_models", providerId: editing.id }),
      } as any);
      setDiscovered(result.models ?? []);
      toast.success(Number(result.models?.length ?? 0).toLocaleString("fa-IR") + " مدل پیدا شد.");
    } catch (e) { toast.error((e as Error).message); }
  };

  if (providersQ.isPending || billingQ.isPending) {
    return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">در حال بارگذاری Provider Registry…</CardContent></Card>;
  }
  if (providersQ.isError) return <Card className="border-destructive/20"><CardContent className="p-8 text-center text-sm text-destructive">{providersQ.error.message}</CardContent></Card>;

  const providers = providersQ.data?.providers ?? [];
  const models = billingQ.data?.models ?? [];
  const trial = providersQ.data?.trial;
  const activeProviderId = trialProviderId || trial?.provider?.id || providers.find((p: any) => p.isTrialProvider)?.id || "";
  const activeModelId = trialModelId || trial?.model?.id || models.find((m: any) => m.trialDefault)?.id || "";

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-black tracking-[.18em] text-primary">MODEL INFRASTRUCTURE</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">Provider Registry</h2>
        <p className="mt-2 max-w-3xl text-xs leading-6 text-muted-foreground">Provider واقعی را ثبت کن، Health آن را تست کن، مدل‌های قابل دریافت را کشف کن و مدل را مستقیم وارد Runtime Catalog کن.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => { void qc.invalidateQueries({ queryKey: ["cc-system-providers"] }); void qc.invalidateQueries({ queryKey: ["cc-billing"] }); }}>
          <RefreshCw className="size-4" /> تازه‌سازی
        </Button>
        <Button onClick={openNew}><Plus className="size-4" /> Provider جدید</Button>
      </div>
    </div>

    <Card className="overflow-hidden border-[#263345] bg-[#0f151d] text-[#e7edf5]">
      <CardHeader className="border-b border-[#263345]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black tracking-[.22em] text-primary">TRIAL ROUTE</p>
            <CardTitle className="mt-1 text-base text-[#eef3f8]">مسیر واقعی نسخه آزمایشی</CardTitle>
            <p className="mt-1 text-[10px] leading-5 text-[#8c99aa]">Trial فقط وقتی آماده است که Provider فعال، کلید معتبر، Model فعال و Health واقعی داشته باشد.</p>
          </div>
          <span className={"rounded-full border px-2.5 py-1 text-[9px] font-bold " + (trial?.ready ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-amber-400/20 bg-amber-400/10 text-amber-200")}>{trial?.ready ? "READY" : "NEEDS CONFIG"}</span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <label className="space-y-2">
          <span className="block text-[10px] font-semibold text-[#a7b5c8]">Provider Trial</span>
          <select className="h-10 w-full rounded-xl border border-[#303c4c] bg-[#0b1016] px-3 text-xs text-[#ecefe6] outline-none focus:border-primary" value={activeProviderId} onChange={e => setTrialProviderId(e.target.value)}>
            <option value="">انتخاب Provider</option>
            {providers.map((p: any) => <option key={p.id} value={p.id}>{p.displayName} · {p.providerName}</option>)}
          </select>
        </label>
        <label className="space-y-2">
          <span className="block text-[10px] font-semibold text-[#a7b5c8]">Model Trial</span>
          <select className="h-10 w-full rounded-xl border border-[#303c4c] bg-[#0b1016] px-3 text-xs text-[#ecefe6] outline-none focus:border-primary" value={activeModelId} onChange={e => setTrialModelId(e.target.value)}>
            <option value="">انتخاب Model</option>
            {models.filter((m: any) => m.active).map((m: any) => <option key={m.id} value={m.id}>{m.displayName} · {m.provider}</option>)}
          </select>
        </label>
        <Button disabled={trialAction.isPending || !activeProviderId || !activeModelId} onClick={() => trialAction.mutate({ providerId: activeProviderId, modelCatalogId: activeModelId })}>
          {trialAction.isPending ? "در حال بررسی اتصال…" : "تست و فعال‌سازی Trial"}
        </Button>
      </CardContent>
    </Card>

    <div className="grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
      <div className="space-y-3">
        {providers.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Providerای ثبت نشده. از «Provider جدید» شروع کن.</CardContent></Card> : providers.map((provider: any) => (
          <Card key={provider.id} className={cn("cursor-pointer border-border transition", editing?.id === provider.id && "border-primary/50 shadow-lg")} onClick={() => openEdit(provider)}>
            <CardContent className="flex items-start gap-3 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ServerCog className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black">{provider.displayName}</p>{provider.isTrialProvider && <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">Trial</span>}</div>
                <p className="mt-1 text-[10px] text-muted-foreground">{provider.providerName} · {provider.protocol}</p>
                <p dir="ltr" className="mt-1 truncate text-[10px] text-muted-foreground">{provider.baseUrl}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[9px]">
                  <span className="rounded-full border px-2 py-1">{provider.configured ? "API Key ✓" : "API Key ندارد"}</span>
                  <span className="rounded-full border px-2 py-1">{Number(provider.modelsCount ?? 0).toLocaleString("fa-IR")} مدل</span>
                  <span className={"rounded-full border px-2 py-1 " + (provider.lastHealthStatus === "healthy" ? "border-emerald-400/20 text-emerald-500" : provider.lastHealthStatus === "error" ? "border-rose-400/20 text-rose-500" : "")}>{provider.lastHealthStatus || "تست نشده"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="min-w-0 border-border">
        {!editing ? <CardContent className="grid min-h-[460px] place-items-center p-10 text-center">
          <div><CloudCog className="mx-auto size-12 text-primary" /><h3 className="mt-4 text-lg font-black">مرکز Providerها</h3><p className="mt-2 max-w-md text-xs leading-6 text-muted-foreground">Provider جدید بساز یا یکی را انتخاب کن. کلید ذخیره‌شده هرگز در UI نمایش داده نمی‌شود.</p></div>
        </CardContent> : <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[9px] font-black tracking-[.2em] text-primary">CONNECTION</p><h3 className="mt-1 text-base font-black">{form.displayName || "Provider جدید"}</h3></div>
            <div className="flex flex-wrap gap-3"><label className="flex items-center gap-2 text-xs"><Switch checked={form.enabled} onCheckedChange={x => setForm(v => ({ ...v, enabled: x, isTrialProvider: x ? v.isTrialProvider : false }))} /> فعال</label><label className="flex items-center gap-2 text-xs"><Switch checked={form.isTrialProvider} onCheckedChange={x => setForm(v => ({ ...v, isTrialProvider: x }))} /> Trial Provider</label></div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="نام نمایشی؛ مثال DeepSeek Production" value={form.displayName} onChange={e=>setForm(v=>({...v,displayName:e.target.value}))}/>
            <Input placeholder="کلید داخلی؛ مثال deepseek-prod" dir="ltr" disabled={Boolean(editing)} value={form.key} onChange={e=>setForm(v=>({...v,key:e.target.value}))}/>
            <Input placeholder="Provider Name" value={form.providerName} onChange={e=>setForm(v=>({...v,providerName:e.target.value}))}/>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-xs" value={form.protocol} onChange={e=>changeProtocol(e.target.value)}>
              <option value="openai-compatible">OpenAI Compatible</option>
              <option value="openrouter">OpenRouter</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Google Gemini</option>
            </select>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-xs" value={form.authMode} onChange={e=>setForm(v=>({...v,authMode:e.target.value}))} disabled={form.protocol==="anthropic"||form.protocol==="gemini"}>
              <option value="bearer">Bearer</option>
              <option value="x-api-key">X-API-Key</option>
              <option value="none">بدون کلید</option>
            </select>
            <Input dir="ltr" placeholder="https://api.example.com/v1" value={form.baseUrl} onChange={e=>setForm(v=>({...v,baseUrl:e.target.value}))}/>
            <Input className="md:col-span-2" dir="ltr" type="password" autoComplete="off" placeholder={editing ? "برای حفظ API Key فعلی خالی بگذار" : "API Key"} value={form.apiKey} onChange={e=>setForm(v=>({...v,apiKey:e.target.value}))}/>
          </div>

          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <div className="flex items-start gap-3"><KeyRound className="mt-0.5 size-4 text-primary"/><div><p className="text-xs font-black">Secret امن</p><p className="mt-1 text-[10px] leading-6 text-muted-foreground">API Key در DB رمزنگاری می‌شود و مقدار ذخیره‌شده به UI برنمی‌گردد. برای تغییرش فقط کلید جدید را وارد کن.</p></div></div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={providerAction.isPending || !form.key || !form.displayName || !form.providerName || !form.baseUrl || (form.authMode !== "none" && !form.apiKey && !editing)} onClick={save}><Save className="size-4"/> ذخیره Provider</Button>
            {editing && <Button variant="outline" onClick={() => void testProvider()} disabled={providerAction.isPending}><Gauge className="size-4"/> تست اتصال</Button>}
            {editing && (form.protocol === "openai-compatible" || form.protocol === "openrouter") && <Button variant="outline" onClick={() => void discoverModels()} disabled={providerAction.isPending}><ListFilter className="size-4"/> کشف مدل‌ها</Button>}
            {editing && <Button variant="outline" className="text-rose-500" onClick={() => { if (window.confirm("این Provider حذف شود؟ فقط Provider بدون مدل قابل حذف است.")) providerAction.mutate({ method: "DELETE", id: editing.id }); }}>حذف</Button>}
          </div>

          {editing && (form.protocol === "openai-compatible" || form.protocol === "openrouter") ? <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black tracking-[.2em] text-primary">MODEL DISCOVERY</p><p className="mt-1 text-sm font-black">مدل‌های قابل دریافت</p></div><span className="text-[10px] text-muted-foreground">{Number(discovered.length).toLocaleString("fa-IR")} مدل</span></div>
            {!discovered.length ? <p className="mt-3 text-xs leading-6 text-muted-foreground">روی «کشف مدل‌ها» بزن. اگر Provider endpoint مدل‌ها نداشته باشد، Model ID را دستی وارد کن.</p> : <div className="mt-3 max-h-52 space-y-1 overflow-auto">{discovered.map(id => <button key={id} type="button" onClick={() => setModelDraft(v => ({ ...v, modelId: id, displayName: id }))} className="flex w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-right hover:border-primary/40"><BrainCircuit className="size-4 text-primary"/><span dir="ltr" className="min-w-0 flex-1 truncate text-left font-mono text-xs">{id}</span></button>)}</div>}
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input dir="ltr" placeholder="Model ID" value={modelDraft.modelId} onChange={e=>setModelDraft(v=>({...v,modelId:e.target.value}))}/>
              <Input placeholder="نام نمایشی مدل" value={modelDraft.displayName} onChange={e=>setModelDraft(v=>({...v,displayName:e.target.value}))}/>
              <Input type="number" dir="ltr" placeholder="هزینه ورودی / ۱M تومان" value={modelDraft.inputTomanPer1M} onChange={e=>setModelDraft(v=>({...v,inputTomanPer1M:e.target.value}))}/>
              <Input type="number" dir="ltr" placeholder="هزینه خروجی / ۱M تومان" value={modelDraft.outputTomanPer1M} onChange={e=>setModelDraft(v=>({...v,outputTomanPer1M:e.target.value}))}/>
            </div>
            <div className="mt-3 flex justify-end"><Button onClick={()=>modelCreate.mutate({ provider: form.providerName, modelId: modelDraft.modelId.trim(), displayName: modelDraft.displayName.trim() || modelDraft.modelId.trim(), inputTomanPer1M: Number(modelDraft.inputTomanPer1M)||0, outputTomanPer1M: Number(modelDraft.outputTomanPer1M)||0, systemProviderId: editing.id, active: true, commercialAvailable: true, trialEnabled: false, trialDefault: false, vision: false, tools: true, reasoning: false })} disabled={modelCreate.isPending || !modelDraft.modelId.trim()}><Plus className="size-4"/> افزودن مدل به Catalog</Button></div>
          </div> : null}
        </CardContent>}
      </Card>
    </div>
  </div>;
}

function SiteControlPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cc-site-control"], queryFn: () => jsonFetch<{ settings: Record<string, string> }>("/api/control-center/settings"), staleTime: 10_000 });
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  if (q.isPending) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">در حال بارگذاری کنترل سایت…</CardContent></Card>;
  if (q.isError) return <Card><CardContent className="p-8 text-center text-sm text-destructive">{q.error.message}</CardContent></Card>;
  const values = { ...(q.data?.settings ?? {}), ...(draft ?? {}) };
  const groups: Array<[string,string[]]> = [
    ["هویت و Landing", ["site.name","site.description","site.welcomeTitle","site.heroTitle","site.heroSubtitle","site.heroPrimaryCta","site.heroSecondaryCta","site.proofLine"]],
    ["احراز هویت", ["site.authTitle","site.authDescription","site.supportEmail"]],
    ["ظاهر", ["site.primaryColor","site.secondaryColor","site.radius","site.sidebarColor"]],
  ];
  const save = async () => {
    try {
      await jsonFetch("/api/control-center/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({settings:values})});
      await qc.invalidateQueries({queryKey:["cc-site-control"]});
      toast.success("تنظیمات سایت ذخیره شد.");
      setDraft(null);
    } catch(e) { toast.error((e as Error).message); }
  };
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black tracking-[.18em] text-primary">SITE CONTROL PLANE</p><h2 className="mt-2 text-2xl font-black">محتوا و ظاهر سایت</h2><p className="mt-2 max-w-3xl text-xs leading-6 text-muted-foreground">Copy، CTA، عنوان‌ها و رنگ‌های اصلی محصول از اینجا بدون تغییر کد قابل مدیریت‌اند.</p></div><Button onClick={save} disabled={!draft}><Save className="size-4"/> ذخیره تغییرات</Button></div>
    {groups.map(([title,keys])=><Card key={title}><CardHeader className="border-b"><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="grid gap-3 p-4 md:grid-cols-2">{keys.map(key=><label key={key} className="space-y-2"><span className="text-[10px] font-bold text-muted-foreground">{key}</span><Input dir={key.includes("Color")||key.includes("radius")||key.includes("Email")?"ltr":"rtl"} value={values[key] ?? ""} onChange={e=>setDraft({...values,[key]:e.target.value})}/></label>)}</CardContent></Card>)}
  </div>;
}

function SecurityPanel({ onLogout }: { onLogout: () => void }) {
  return <div className="space-y-5">
    <div><p className="text-[10px] font-black tracking-[.18em] text-primary">SECURITY</p><h2 className="mt-2 text-2xl font-black">امنیت و دسترسی</h2><p className="mt-2 max-w-3xl text-xs leading-6 text-muted-foreground">اطلاعات نشست و مسیرهای ورود مدیر را از همین پنل بررسی کن.</p></div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="text-sm">مدیر اصلی</CardTitle></CardHeader><CardContent className="space-y-3 text-xs"><div className="flex items-center justify-between rounded-xl border p-3"><span className="text-muted-foreground">نام کاربری</span><b dir="ltr">ehsanam86</b></div><div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3 text-[10px] leading-6 text-muted-foreground">احراز هویت با Session کوکی HttpOnly انجام می‌شود و Secret در URL یا UI نمایش داده نمی‌شود.</div><Button variant="destructive" onClick={onLogout}><LogOut className="size-4"/> خروج از پنل</Button></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">مسیرهای مدیریت</CardTitle></CardHeader><CardContent className="space-y-2 text-xs"><div className="flex justify-between rounded-xl border p-3"><span>/admin/login</span><span className="text-muted-foreground">ورود</span></div><div className="flex justify-between rounded-xl border p-3"><span>/admin/console</span><span className="text-emerald-500">فعال</span></div><div className="flex justify-between rounded-xl border p-3"><span>/ops/[routeKey]</span><span className="text-muted-foreground">مسیر قدیمی</span></div></CardContent></Card>
    </div>
  </div>;
}


