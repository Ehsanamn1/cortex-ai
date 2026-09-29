"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CircleX,
  Link2,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Provider = {
  id: string;
  key: string;
  displayName: string;
  providerName: string;
  protocol: string;
  authMode: string;
  baseUrl: string;
  enabled: boolean;
  isTrialProvider: boolean;
  configured: boolean;
  lastHealthStatus: string | null;
  lastHealthError: string | null;
  lastHealthAt: string | null;
  modelsCount: number;
  updatedAt: string;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({})) as { error?: string; data?: T } & T;
  if (!response.ok) throw new Error(body.error || "درخواست ناموفق بود.");
  return (body.data ?? body) as T;
}

const emptyDraft = {
  key: "",
  displayName: "",
  providerName: "",
  protocol: "openai-compatible",
  authMode: "bearer",
  baseUrl: "",
  apiKey: "",
  enabled: true,
  isTrialProvider: false,
};

export function ProviderRegistryPanel() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testModel, setTestModel] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const result = await request<{ providers: Provider[] }>("/api/control-center/providers");
      setProviders(result.providers ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خواندن Providerها ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(provider: Provider) {
    setEditingId(provider.id);
    setDraft({
      key: provider.key,
      displayName: provider.displayName,
      providerName: provider.providerName,
      protocol: provider.protocol,
      authMode: provider.authMode,
      baseUrl: provider.baseUrl,
      apiKey: "",
      enabled: provider.enabled,
      isTrialProvider: provider.isTrialProvider,
    });
  }

  async function saveDraft() {
    if (!draft.key || !draft.displayName || !draft.providerName || !draft.baseUrl) {
      toast.error("Key، نام، Provider Name و Base URL را کامل کن.");
      return;
    }
    setBusy("draft");
    try {
      if (editingId) {
        await request("/api/control-center/providers", {
          method: "PATCH",
          body: JSON.stringify({ id: editingId, ...draft, apiKey: draft.apiKey || undefined }),
        });
        toast.success("Provider به‌روزرسانی شد.");
      } else {
        await request("/api/control-center/providers", {
          method: "POST",
          body: JSON.stringify(draft),
        });
        toast.success("Provider ثبت شد.");
      }
      setDraft(emptyDraft);
      setEditingId(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره Provider ناموفق بود.");
    } finally {
      setBusy(null);
    }
  }

  async function testProvider(provider: Provider) {
    const modelId = testModel[provider.id]?.trim();
    if (!modelId) {
      toast.error("برای تست، Model ID را وارد کن.");
      return;
    }
    setBusy("test:" + provider.id);
    try {
      const result = await request<{ health: { ok: boolean; latencyMs?: number; error?: string } }>(
        "/api/control-center/providers",
        { method: "POST", body: JSON.stringify({ action: "test", id: provider.id, modelId }) },
      );
      if (result.health.ok) toast.success("Provider سالم است · " + Math.round(result.health.latencyMs ?? 0) + "ms");
      else toast.error(result.health.error ?? "Health check ناموفق بود.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Health check ناموفق بود.");
    } finally {
      setBusy(null);
    }
  }

  async function removeProvider(id: string) {
    if (!window.confirm("این Provider حذف شود؟ فقط Provider بدون مدل متصل قابل حذف است.")) return;
    setBusy("delete:" + id);
    try {
      await request("/api/control-center/providers?id=" + encodeURIComponent(id), { method: "DELETE" });
      toast.success("Provider حذف شد.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حذف Provider ناموفق بود.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden border border-[#293126] bg-[#0f130f] p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(180,216,75,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(180,216,75,.05)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold tracking-[0.24em] text-[#b5d84b]">PROVIDER CONTROL PLANE</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-4xl">منبع واقعی مدل‌ها را اینجا تعریف کن.</h2>
            <p className="mt-3 text-sm leading-7 text-[#9ca695]">
              API Key و Base URL فقط در سمت سرور نگه‌داری می‌شوند. بعد از ثبت Provider، مدل‌ها را به آن متصل می‌کنی، برای پلن‌ها دسترسی می‌دهی و در صورت نیاز همان مدل را به‌عنوان موتور پیش‌فرض نسخه آزمایشی تعیین می‌کنی.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Signal label="Provider فعال" value={providers.filter((item) => item.enabled).length} />
            <Signal label="Trial Provider" value={providers.filter((item) => item.isTrialProvider).length} />
            <Signal label="Model bindings" value={providers.reduce((sum, item) => sum + item.modelsCount, 0)} />
          </div>
        </div>
      </section>

      <Card className="rounded-none border-[#2b3428] bg-[#121711]">
        <CardHeader className="border-b border-[#2b3428]">
          <CardTitle className="flex items-center gap-2 text-sm text-white">
            {editingId ? <Pencil className="size-4 text-[#b5d84b]" /> : <Plus className="size-4 text-[#b5d84b]" />}
            {editingId ? "ویرایش Provider" : "اتصال Provider جدید"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <Input placeholder="Key داخلی، مثال gateway-primary" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} className="border-[#313a2d] bg-[#0d100d] text-white" />
          <Input placeholder="نام نمایشی" value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} className="border-[#313a2d] bg-[#0d100d] text-white" />
          <Input placeholder="Provider Name" value={draft.providerName} onChange={(e) => setDraft({ ...draft, providerName: e.target.value })} className="border-[#313a2d] bg-[#0d100d] text-white" />
          <Input dir="ltr" placeholder="https://gateway.example/v1" value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} className="border-[#313a2d] bg-[#0d100d] text-left text-white" />
          <select value={draft.protocol} onChange={(e) => setDraft({ ...draft, protocol: e.target.value })} className="h-9 rounded-md border border-[#313a2d] bg-[#0d100d] px-3 text-xs text-white">
            <option value="openai-compatible">OpenAI compatible</option>
            <option value="openrouter">OpenRouter</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
          </select>
          <select value={draft.authMode} onChange={(e) => setDraft({ ...draft, authMode: e.target.value })} className="h-9 rounded-md border border-[#313a2d] bg-[#0d100d] px-3 text-xs text-white">
            <option value="bearer">Bearer</option>
            <option value="x-api-key">x-api-key</option>
            <option value="none">بدون کلید</option>
          </select>
          <Input dir="ltr" type="password" autoComplete="new-password" placeholder={editingId ? "API Key جدید (اختیاری)" : "API Key"} value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} className="border-[#313a2d] bg-[#0d100d] text-left text-white" />
          <div className="flex items-center justify-between border border-[#313a2d] bg-[#0d100d] px-3">
            <div><p className="text-xs font-semibold text-white">فعال</p><p className="text-[9px] text-[#768070]">در Resolve قابل استفاده باشد</p></div>
            <Switch checked={draft.enabled} onCheckedChange={(value) => setDraft({ ...draft, enabled: value })} />
          </div>
          <div className="flex items-center justify-between border border-[#313a2d] bg-[#0d100d] px-3 xl:col-span-2">
            <div><p className="text-xs font-semibold text-white">Provider نسخه آزمایشی</p><p className="text-[9px] text-[#768070]">منبع پیش‌فرض Trial</p></div>
            <Switch checked={draft.isTrialProvider} onCheckedChange={(value) => setDraft({ ...draft, isTrialProvider: value })} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-2">
            <Button className="w-full rounded-none bg-[#b5d84b] text-[#10140e] hover:bg-[#c6e75e]" disabled={busy === "draft"} onClick={() => void saveDraft()}><Save />{busy === "draft" ? "در حال ذخیره…" : editingId ? "ذخیره تغییرات" : "ثبت Provider"}</Button>
            {editingId && <Button variant="outline" className="w-full rounded-none border-[#3a4435] text-white" onClick={() => { setEditingId(null); setDraft(emptyDraft); }}>لغو و ساخت جدید</Button>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {providers.map((provider) => {
          const healthy = provider.lastHealthStatus === "healthy";
          const failed = provider.lastHealthStatus === "error";
          return (
            <Card key={provider.id} className="rounded-none border-[#2b3428] bg-[#121711]">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-11 shrink-0 place-items-center border border-[#35402f] bg-[#0c100c] text-[#b5d84b]"><Plug className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-black text-white">{provider.displayName}</p>
                      {provider.isTrialProvider && <span className="border border-[#b5d84b]/30 bg-[#b5d84b]/10 px-2 py-1 text-[8px] font-bold text-[#b5d84b]">TRIAL SOURCE</span>}
                      {provider.enabled ? <span className="border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[8px] text-emerald-300">ACTIVE</span> : <span className="border border-white/10 px-2 py-1 text-[8px] text-[#788174]">OFF</span>}
                    </div>
                    <p className="mt-1 break-all font-mono text-[10px] text-[#899286]">{provider.providerName} · {provider.protocol} · {provider.baseUrl}</p>
                  </div>
                  {healthy ? <CheckCircle2 className="size-5 text-emerald-400" /> : failed ? <XCircle className="size-5 text-rose-400" /> : <Activity className="size-5 text-[#788174]" />}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Signal label="Key" value={provider.configured ? "OK" : "—"} />
                  <Signal label="Models" value={provider.modelsCount} />
                  <Signal label="Health" value={provider.lastHealthStatus ?? "unknown"} />
                  <Signal label="Updated" value={new Date(provider.updatedAt).toLocaleDateString("fa-IR")} />
                </div>

                {provider.lastHealthError && <div className="mt-3 border border-rose-400/15 bg-rose-400/[.045] p-3 text-[10px] leading-5 text-rose-200">{provider.lastHealthError}</div>}

                <div className="mt-4 flex flex-col gap-2 border-t border-[#2b3428] pt-4 sm:flex-row">
                  <Input dir="ltr" placeholder="Model ID برای تست Health" value={testModel[provider.id] ?? ""} onChange={(e) => setTestModel({ ...testModel, [provider.id]: e.target.value })} className="border-[#313a2d] bg-[#0d100d] text-left text-xs text-white" />
                  <Button size="sm" variant="outline" className="rounded-none border-[#3a4435] text-white" disabled={busy === "test:" + provider.id} onClick={() => void testProvider(provider)}><RefreshCw className={cn("size-3.5", busy === "test:" + provider.id && "animate-spin")} />تست اتصال</Button>
                  <Button size="sm" variant="outline" className="rounded-none border-[#3a4435] text-white" onClick={() => startEdit(provider)}><Pencil className="size-3.5" />ویرایش</Button>
                  <Button size="sm" variant="ghost" className="rounded-none text-rose-300 hover:bg-rose-400/10" disabled={busy === "delete:" + provider.id} onClick={() => void removeProvider(provider.id)}><Trash2 className="size-3.5" />حذف</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!providers.length && !loading && <Card className="rounded-none border-dashed border-[#394333] bg-transparent xl:col-span-2"><CardContent className="p-10 text-center text-xs text-[#818b7c]"><Plug className="mx-auto size-8 text-[#b5d84b]" /><p className="mt-3 font-semibold text-white">هنوز Provider سیستم ثبت نشده.</p><p className="mt-1 leading-6">اول Provider واقعی خودت را ثبت کن؛ بعد از بخش کاتالوگ مدل، آن را به مدل‌های قابل‌عرضه متصل کن.</p></CardContent></Card>}
      </div>

      <div className="border border-[#313a2d] bg-[#10150f] p-4 text-[10px] leading-6 text-[#84907f]">
        <p className="flex items-center gap-2 font-semibold text-[#b5d84b]"><ShieldCheck className="size-3.5" />قرارداد این لایه</p>
        <p className="mt-1">مشتری هرگز API Key، Base URL یا نام مسیر تأمین‌کننده را نمی‌بیند. فقط نام Cortex و مدل‌های مجاز پلن خودش را می‌بیند.</p>
        <p className="mt-1">برای Trial، یک Provider را به‌عنوان منبع نسخه آزمایشی علامت بزن و یک ModelCatalog را در بخش مدل‌ها روی «Default Trial» قرار بده.</p>
      </div>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string | number }) {
  return <div className="border border-[#2f382b] bg-[#0c100c] px-3 py-2"><p className="text-[8px] uppercase tracking-[.14em] text-[#697363]">{label}</p><p className="mt-1 truncate text-xs font-bold text-white">{String(value)}</p></div>;
}
