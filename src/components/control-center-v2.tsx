"use client";

import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, Bot, Boxes, CheckCircle2, CircleX, Clock3, CreditCard, Database, FileText, Gauge, History, LayoutDashboard,
  LogOut, MessageSquare, Pencil, Plug, Power, RefreshCw, Save, Search, Send, Settings2,
  Users, WalletCards, Workflow, Server, KeyRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Section =
  | "overview" | "users" | "workspaces" | "agents" | "knowledge" | "conversations"
  | "telegram" | "providers" | "workflows" | "executions" | "audit" | "plugins"
  | "plans" | "models" | "accounts" | "charges" | "invoices" | "topups" | "systemProviders" | "settings";

const SECTIONS: Array<{ id: Section; label: string; group: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "نمای کلی", group: "اصلی", icon: LayoutDashboard },
  { id: "users", label: "کاربران", group: "مدیریت", icon: Users },
  { id: "workspaces", label: "فضاهای کاری", group: "مدیریت", icon: Boxes },
  { id: "agents", label: "ایجنت‌ها", group: "AI", icon: Bot },
  { id: "knowledge", label: "دانش", group: "AI", icon: Database },
  { id: "conversations", label: "گفتگوها", group: "AI", icon: MessageSquare },
  { id: "telegram", label: "بات‌های تلگرام", group: "اتصال‌ها", icon: Send },
  { id: "providers", label: "اتصال‌های قدیمی", group: "اتصال‌ها", icon: Plug },
  { id: "systemProviders", label: "AI زیرساخت", group: "اتصال‌ها", icon: Server },
  { id: "workflows", label: "Workflowها", group: "عملیات", icon: Workflow },
  { id: "executions", label: "Executionها", group: "عملیات", icon: Activity },
  { id: "audit", label: "Audit Log", group: "امنیت", icon: History },
  { id: "plugins", label: "افزونه‌ها", group: "سیستم", icon: Settings2 },
  { id: "plans", label: "پلن‌ها", group: "Billing", icon: CreditCard },
  { id: "models", label: "کاتالوگ مدل‌ها", group: "Billing", icon: Gauge },
  { id: "accounts", label: "حساب‌های اعتباری", group: "Billing", icon: WalletCards },
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
    : section === "providers"
    ? [["scope","سطح"],["providerName","Provider"],["model","مدل"],["workspace.name","فضا"],["configured","کلید"],["enabled","فعال"]]
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
              {["agents","providers","plugins"].includes(section) && <Button size="sm" variant="ghost" onClick={() => {
                if (section === "agents") toggle.mutate({ resource: "agents", id: row.id, status: row.status === "active" ? "paused" : "active" });
                else if (section === "providers") toggle.mutate({ resource: "providers", id: row.id, enabled: !row.enabled, status: row.scope });
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
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{model.displayName}</p>{model.trialDefault && <span className="rounded-full bg-[#e9f4c6] px-2 py-1 text-[9px] font-bold text-[#506422]">Trial Default</span>}{model.systemProvider?.displayName && <span className="rounded-full border px-2 py-1 text-[9px] text-muted-foreground">{model.systemProvider.displayName}</span>}</div><p className="mt-1 text-[11px] text-muted-foreground">{model.provider} · <code>{model.modelId}</code></p></div>
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
  return <div className="grid gap-3 sm:grid-cols-2"><Input value={v.name} onChange={e=>setV({...v,name:e.target.value})} placeholder="نام"/><Input type="number" value={v.priceToman} onChange={e=>setV({...v,priceToman:e.target.value})} placeholder="قیمت"/><Input type="number" value={v.monthlyCredits} onChange={e=>setV({...v,monthlyCredits:e.target.value})} placeholder="اعتبار"/><Input type="number" value={v.overageCreditPriceToman} onChange={e=>setV({...v,overageCreditPriceToman:e.target.value})} placeholder="Overage"/><Button onClick={()=>onSave({name:v.name,priceToman:Number(v.priceToman),monthlyCredits:Number(v.monthlyCredits),overageCreditPriceToman:Number(v.overageCreditPriceToman)})}><Save/>ذخیره</Button></div>;
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
  if(session.isPending) return <div className="min-h-screen bg-[#f6f7fb] p-8"><div className="mx-auto max-w-7xl rounded-xl bg-white p-12 text-center">در حال بارگذاری مرکز مدیریت…</div></div>;
  if(session.isError) return <AdminLogin />;
  const groups=[...new Set(SECTIONS.map(x=>x.group))]; const m=summary.data?.metrics??{}; const activeSection=SECTIONS.find(x=>x.id===section)!;
  return <div className="cortex-control-center min-h-screen bg-[#f6f7fb] text-foreground" dir="rtl"><div className="flex min-h-screen">
    <aside className="hidden w-[250px] shrink-0 border-l border-border bg-white lg:flex lg:flex-col">
      <div className="border-b border-border p-5"><div className="text-lg font-extrabold tracking-tight text-slate-900">Cortex <span className="text-primary">Admin</span></div><p className="mt-1 text-[10px] text-muted-foreground">Operational Control Center</p></div>
      <nav className="flex-1 overflow-y-auto p-3">{groups.map(group=><div key={group} className="mb-5"><p className="px-3 pb-2 text-[9px] font-bold tracking-[.18em] text-slate-400">{group.toUpperCase()}</p><div className="space-y-1">{SECTIONS.filter(s=>s.group===group).map(s=><button key={s.id} type="button" onClick={()=>{setSection(s.id);setSearch("");}} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium",section===s.id?"bg-[#eef3ff] text-[#3f6fe5]":"text-slate-600 hover:bg-slate-50")}><s.icon className="size-4 shrink-0"/><span>{s.label}</span></button>)}</div></div>)}</nav>
      <div className="border-t border-border p-4"><div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5"><span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">{session.data?.username?.slice(0,2).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{session.data?.username}</p><p className="text-[9px] text-muted-foreground">Administrator</p></div><Button variant="ghost" size="icon" onClick={()=>logout.mutate()}><LogOut className="size-4"/></Button></div></div>
    </aside>
    <div className="min-w-0 flex-1"><header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur"><div className="flex items-center gap-3 px-4 py-3 lg:px-7"><div className="min-w-0 flex-1"><p className="text-[9px] font-bold tracking-[.18em] text-primary">CORTEX CONTROL CENTER</p><h1 className="truncate text-lg font-bold">{activeSection.label}</h1></div><div className="hidden w-[260px] items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2 md:flex"><Search className="size-4 text-muted-foreground"/><Input value={search} onChange={e=>setSearch(e.target.value)} className="h-5 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0" placeholder="جستجو…"/></div><Button variant="outline" size="icon" onClick={()=>{qc.invalidateQueries();toast.success("داده‌ها تازه شد")}}><RefreshCw className="size-4"/></Button></div></header>
      <div className="flex gap-1 overflow-x-auto border-b bg-white px-3 py-2 lg:hidden">
        {SECTIONS.map(s=><button key={s.id} type="button" onClick={()=>setSection(s.id)} className={cn("whitespace-nowrap rounded-md px-3 py-2 text-[10px] font-medium",section===s.id?"bg-[#eef3ff] text-[#3f6fe5]":"text-slate-600")}>{s.label}</button>)}
      </div>
      <main className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-7">
        {section==="overview"?<Overview summary={summary.data}/>:section==="settings"?<SettingsPanel/>:["plans","models","accounts","charges","invoices","topups"].includes(section)?<BillingPanel section={section}/>:<DataTable section={section} search={search}/>}
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
  const q = useQuery({
    queryKey: ["cc-system-providers"],
    queryFn: () => jsonFetch<{ providers: any[] }>("/api/control-center/providers"),
    staleTime: 5_000,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async ({ mode, body }: { mode: "create" | "update" | "test"; body: Record<string, unknown> }) => {
      const id = typeof body.id === "string" ? body.id : "";
      const response = await fetch("/api/control-center/providers" + (mode === "delete" ? "?id=" + encodeURIComponent(id) : ""), {
        method: mode === "update" || mode === "test" ? (mode === "test" ? "POST" : "PATCH") : "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "update" ? body : { ...body, action: mode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || payload.message || "عملیات Provider ناموفق بود.");
      return payload.data ?? payload;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["cc-system-providers"] });
      qc.invalidateQueries({ queryKey: ["cc-billing"] });
      toast.success(vars.mode === "test" ? "تست Provider انجام شد." : "Provider ذخیره شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isPending) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">در حال بارگذاری زیرساخت AI…</CardContent></Card>;
  if (q.isError) return <Card className="border-destructive/20"><CardContent className="p-8 text-center text-sm text-destructive">{q.error.message}</CardContent></Card>;
  const providers = q.data?.providers ?? [];
  return <div className="space-y-4">
    <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <Card className="border-[#d8ddcf] bg-[#f8faf4]">
        <CardHeader><CardTitle className="text-sm">Registry تأمین هوش</CardTitle><p className="text-[10px] leading-5 text-muted-foreground">هر Provider فقط یک بار اینجا تعریف می‌شود. مدل‌های Cortex بعداً به همین Provider متصل می‌شوند؛ API Key هیچ‌وقت به کاربر نهایی ارسال نمی‌شود.</p></CardHeader>
        <CardContent><ProviderEditor onSave={(body) => save.mutate({ mode: "create", body })} pending={save.isPending}/></CardContent>
      </Card>
      <Card className="border-[#d8ddcf] bg-white">
        <CardHeader><CardTitle className="text-sm">منطق جریان</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-xs leading-7 text-muted-foreground">
          <div className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center bg-[#dff2a7] text-[#273018]">۱</span><p>Provider را تعریف می‌کنی: Base URL، Protocol و API Key.</p></div>
          <div className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center bg-[#dff2a7] text-[#273018]">۲</span><p>در کاتالوگ مدل، مدل را به Provider وصل می‌کنی.</p></div>
          <div className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center bg-[#dff2a7] text-[#273018]">۳</span><p>دسترسی مدل به Free/Launch/Growth/Scale/Enterprise را تعیین می‌کنی.</p></div>
          <div className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center bg-[#dff2a7] text-[#273018]">۴</span><p>برای Trial یک مدل را Default می‌کنی؛ همه Workspaceهای آزمایشی از همان مسیر تغذیه می‌شوند.</p></div>
        </CardContent>
      </Card>
    </section>

    <div className="grid gap-3">
      {providers.map((provider) => <Card key={provider.id} className={cn("border-border", provider.isTrialProvider && "border-[#b8d75b]/60 shadow-[0_12px_40px_rgba(121,146,47,.10)]")}>
        <CardContent className="p-4">
          {editing === provider.id
            ? <ProviderEditor initial={provider} onSave={(body) => save.mutate({ mode: "update", body: { ...body, id: provider.id } })} pending={save.isPending} />
            : <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black">{provider.displayName}</p>{provider.isTrialProvider && <span className="rounded-full bg-[#e9f4c6] px-2 py-1 text-[9px] font-bold text-[#506422]">Provider پیش‌فرض Trial</span>}{provider.enabled ? <span className="text-[9px] text-emerald-700">فعال</span> : <span className="text-[9px] text-rose-700">غیرفعال</span>}</div><p className="mt-1 text-[10px] text-muted-foreground">{provider.providerName} · {provider.protocol} · <span dir="ltr">{provider.baseUrl}</span></p><p className="mt-1 text-[10px] text-muted-foreground">{provider.configured ? "کلید تنظیم شده" : "بدون API Key"} · {provider.modelsCount ?? 0} مدل متصل</p></div>
                <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => save.mutate({ mode: "test", body: { id: provider.id, modelId: provider.testModelId || "gpt-4o-mini" } })} disabled={save.isPending}><Gauge className="size-3.5"/>تست</Button><Button size="sm" variant="outline" onClick={() => setEditing(provider.id)}><Pencil className="size-3.5"/>ویرایش</Button></div>
              </div>}
        </CardContent>
      </Card>)}
      {!providers.length && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">هنوز Provider سراسری ثبت نشده است.</CardContent></Card>}
    </div>
  </div>;
}

function ProviderEditor({ initial, onSave, pending }: { initial?: any; onSave: (body: Record<string, unknown>) => void; pending: boolean }) {
  const [v, setV] = useState({
    key: initial?.key ?? "primary",
    displayName: initial?.displayName ?? "",
    providerName: initial?.providerName ?? "OpenAI",
    protocol: initial?.protocol ?? "openai-compatible",
    authMode: initial?.authMode ?? "bearer",
    baseUrl: initial?.baseUrl ?? "https://api.openai.com/v1",
    apiKey: "",
    enabled: initial?.enabled ?? true,
    isTrialProvider: initial?.isTrialProvider ?? false,
  });
  const set = (k: string, value: unknown) => setV((x) => ({ ...x, [k]: value }));
  return <div className="grid gap-3 sm:grid-cols-2">
    <Input value={v.key} onChange={e=>set("key",e.target.value)} placeholder="کلید داخلی مثل primary"/>
    <Input value={v.displayName} onChange={e=>set("displayName",e.target.value)} placeholder="نام نمایشی"/>
    <Input value={v.providerName} onChange={e=>set("providerName",e.target.value)} placeholder="نام Provider"/>
    <select className="h-9 rounded-md border border-input bg-background px-3 text-xs" value={v.protocol} onChange={e=>set("protocol",e.target.value)}><option value="openai-compatible">OpenAI-compatible</option><option value="openrouter">OpenRouter</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option></select>
    <select className="h-9 rounded-md border border-input bg-background px-3 text-xs" value={v.authMode} onChange={e=>set("authMode",e.target.value)}><option value="bearer">Bearer</option><option value="x-api-key">x-api-key</option><option value="none">بدون کلید</option></select>
    <Input dir="ltr" value={v.baseUrl} onChange={e=>set("baseUrl",e.target.value)} placeholder="https://provider.example/v1"/>
    <Input className="sm:col-span-2" dir="ltr" type="password" value={v.apiKey} onChange={e=>set("apiKey",e.target.value)} placeholder={initial ? "برای نگه‌داشتن کلید فعلی خالی بگذار" : "API Key"} autoComplete="off"/>
    <div className="flex items-center justify-between rounded-xl border bg-background p-3"><div><p className="text-xs font-semibold">فعال</p><p className="text-[10px] text-muted-foreground">برای Route شدن مدل‌ها در دسترس باشد.</p></div><Switch checked={v.enabled} onCheckedChange={x=>set("enabled",x)}/></div>
    <div className="flex items-center justify-between rounded-xl border bg-background p-3"><div><p className="text-xs font-semibold">Provider مخصوص Trial</p><p className="text-[10px] text-muted-foreground">در هر لحظه فقط یک Provider Trial پیش‌فرض است.</p></div><Switch checked={v.isTrialProvider} onCheckedChange={x=>set("isTrialProvider",x)}/></div>
    <div className="sm:col-span-2"><Button className="w-full sm:w-auto" disabled={pending || !v.key || !v.displayName || !v.providerName || !v.baseUrl || (v.authMode!=="none" && !v.apiKey && !initial)} onClick={()=>onSave({...v})}>{pending ? "در حال ذخیره…" : initial ? "ذخیره Provider" : "ثبت Provider سراسری"}</Button></div>
  </div>;
}

function SettingsPanel() {
  const q=useQuery({queryKey:["cc-settings"],queryFn:()=>jsonFetch<{settings:Record<string,string>}>("/api/control-center/settings")});
  const qc=useQueryClient(); const [draft,setDraft]=useState<Record<string,string>>({});
  const save=useMutation({mutationFn:()=>jsonFetch("/api/control-center/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({settings:{...(q.data?.settings??{}),...draft}})}),onSuccess:()=>{qc.invalidateQueries({queryKey:["cc-settings"]});toast.success("تنظیمات ذخیره شد")},onError:(e:Error)=>toast.error(e.message)});
  if(q.isPending) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">در حال بارگذاری تنظیمات…</CardContent></Card>;
  const s={...(q.data?.settings??{}),...draft};
  const fields=[["site.name","نام محصول"],["site.welcomeTitle","عنوان خوش‌آمدگویی"],["site.description","توضیحات"],["site.supportEmail","ایمیل پشتیبانی"],["site.authTitle","عنوان ورود"],["site.authDescription","توضیحات ورود"],["site.primaryColor","رنگ اصلی"],["site.secondaryColor","رنگ ثانویه"],["site.sidebarColor","رنگ Sidebar"],["site.navOrder","ترتیب منو"]];
  return <Card className="border-border"><CardHeader><CardTitle className="text-sm">تنظیمات محصول و رابط کاربری</CardTitle><p className="text-[10px] text-muted-foreground">همان SiteSetting فعلی؛ بدون hard-code کردن مقدارهای عملیاتی.</p></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{fields.map(([k,l])=><div key={k}><label className="text-xs font-medium">{l}</label><Input className="mt-2" dir={k.includes("Color")||k.includes("Email")?"ltr":"rtl"} value={s[k]??""} onChange={e=>setDraft({...draft,[k]:e.target.value})}/></div>)}<div className="md:col-span-2 flex justify-end"><Button onClick={()=>save.mutate()} disabled={save.isPending}><Save/>ذخیره تنظیمات</Button></div></CardContent></Card>;
}

function AdminLogin() {
  return <div className="grid min-h-screen place-items-center bg-[#10130f] p-4" dir="rtl">
    <Card className="w-full max-w-lg border-[#35402f] bg-[#151914] text-[#ecebe3]">
      <CardHeader><CardTitle className="text-xl">پیشخوان خصوصی Cortex</CardTitle><p className="text-xs leading-6 text-[#9fa896]">این محیط فقط از طریق لینک مدیریتی خصوصی قابل ورود است. فرم نام کاربری و رمز عبور عمداً در این پنل ارائه نمی‌شود.</p></CardHeader>
      <CardContent className="space-y-3"><div className="flex items-center gap-3 rounded-xl border border-[#3a4633] bg-[#0f120e] p-4"><KeyRound className="size-5 text-[#b9db55]"/><p className="text-xs leading-6 text-[#a9b2a2]">از لینک خصوصی مدیر استفاده کن؛ پس از تأیید، یک نشست کوتاه‌مدت HttpOnly ساخته می‌شود.</p></div><p className="text-[10px] leading-5 text-[#737b70]">توکن لینک در رابط کاربری یا پاسخ‌های API نمایش داده نمی‌شود.</p></CardContent>
    </Card>
  </div>;
}
