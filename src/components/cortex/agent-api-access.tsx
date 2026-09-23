"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Copy, KeyRound, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/cortex-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AgentApiAccess({ agentId }: { agentId:string }) {
  const queryClient=useQueryClient();
  const [name,setName]=useState("کلید اصلی");
  const [newKey,setNewKey]=useState("");
  const access=useQuery({queryKey:["agent-api-access",agentId],queryFn:()=>api.getAgentApiAccess(agentId)});
  const create=useMutation({mutationFn:()=>api.createAgentApiKey(agentId,name.trim()||"کلید API"),onSuccess:(data)=>{setNewKey(data.key);setName("کلید جدید");queryClient.invalidateQueries({queryKey:["agent-api-access",agentId]});toast.success("کلید API ساخته شد.")},onError:(error:Error)=>toast.error(error.message)});
  const revoke=useMutation({mutationFn:(keyId:string)=>api.revokeAgentApiKey(agentId,keyId),onSuccess:()=>{queryClient.invalidateQueries({queryKey:["agent-api-access",agentId]});toast.success("کلید API غیرفعال شد.")},onError:(error:Error)=>toast.error(error.message)});
  async function copyValue(value:string,label:string){try{await navigator.clipboard.writeText(value);toast.success(label+" کپی شد.")}catch{toast.error("کپی انجام نشد.")}}
  return <div className="space-y-4">
    <Card className="cortex-panel rounded-2xl border-primary/15">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4 text-primary"/>API دسترسی ایجنت</CardTitle><CardDescription>ایجنت را سریع به سایت، اپلیکیشن، Telegram bridge و ابزارهای دیگر وصل کن. کلید کامل فقط لحظه ساخت نمایش داده می‌شود.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-2">
          <div><Label>Base URL</Label><div className="mt-2 flex gap-2"><Input dir="ltr" readOnly value={access.data?.baseUrl??""} className="text-left text-xs"/><Button size="icon" variant="outline" disabled={!access.data?.baseUrl} onClick={()=>access.data&&copyValue(access.data.baseUrl,"Base URL")}><Copy/></Button></div></div>
          <div><Label>Endpoint اختصاصی ایجنت</Label><div className="mt-2 flex gap-2"><Input dir="ltr" readOnly value={access.data?.endpoint??""} className="text-left text-xs"/><Button size="icon" variant="outline" disabled={!access.data?.endpoint} onClick={()=>access.data&&copyValue(access.data.endpoint,"Endpoint")}><Copy/></Button></div></div>
        </div>
        <div className="rounded-xl border border-white/[.06] bg-white/[.018] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="min-w-0 flex-1"><Label>نام کلید</Label><Input className="mt-2" value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></div><Button disabled={create.isPending} onClick={()=>create.mutate()}>{create.isPending?<Loader2 className="animate-spin"/>:<Plus/>ساخت کلید جدید</Button></div>
          {newKey&&<div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] p-4"><div className="flex items-center gap-2 text-sm font-medium text-emerald-300"><CheckCircle2 className="size-4"/>کلید ساخته شد</div><p className="mt-1 text-[11px] leading-5 text-muted-foreground">این کلید دیگر از سرور قابل بازیابی نیست؛ امن نگهش دار.</p><div className="mt-3 flex gap-2"><Input dir="ltr" readOnly value={newKey} className="font-mono text-[11px] text-left"/><Button size="icon" variant="outline" onClick={()=>copyValue(newKey,"API Key")}><Copy/></Button></div></div>}
        </div>
        <div className="rounded-xl border border-white/[.06] bg-black/10 p-4"><div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-primary"/>OpenAI-compatible</div><p className="mt-1 text-xs leading-6 text-muted-foreground">برای ابزارهایی که Base URL + API Key می‌گیرند، Base URL بالا و Endpoint سازگار را استفاده کن و کلید را با Authorization: Bearer بفرست.</p><div className="mt-3 flex gap-2"><Input dir="ltr" readOnly value={access.data?.openAiEndpoint??""} className="text-left text-xs"/><Button size="icon" variant="outline" disabled={!access.data?.openAiEndpoint} onClick={()=>access.data&&copyValue(access.data.openAiEndpoint,"OpenAI endpoint")}><Copy/></Button></div></div>
      </CardContent>
    </Card>
    <Card className="cortex-panel rounded-2xl"><CardHeader><CardTitle className="text-base">کلیدهای API</CardTitle><CardDescription>کلیدهای غیرفعال دیگر امکان دسترسی ندارند.</CardDescription></CardHeader><CardContent>{access.isPending?<div className="h-20 animate-pulse rounded-xl bg-muted"/>:(access.data?.keys??[]).length===0?<p className="py-8 text-center text-sm text-muted-foreground">هنوز کلیدی ساخته نشده است.</p>:<div className="space-y-2">{access.data.keys.map(k=><div key={k.id} className="flex flex-col gap-3 rounded-xl border border-white/[.06] p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{k.name}</p><p dir="ltr" className="text-[11px] text-muted-foreground">{k.keyPrefix}…</p></div><span className="rounded-full border border-white/[.06] px-2 py-1 text-[10px]">{k.active?"فعال":"غیرفعال"}</span>{k.active&&<Button size="icon" variant="ghost" className="text-destructive" onClick={()=>revoke.mutate(k.id)} disabled={revoke.isPending} aria-label="غیرفعال سازی"><Trash2/></Button>}</div>)}</div>}</CardContent></Card>
  </div>;
}