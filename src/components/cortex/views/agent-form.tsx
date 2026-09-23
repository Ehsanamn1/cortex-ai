"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { api, type AgentDto, type CreateAgentInput, type UpdateAgentInput } from "@/lib/cortex-client";
import { useCortexStore } from "@/components/cortex/store";
import { zodResolver } from "@/components/cortex/zod-resolver";
import { ErrorState } from "@/components/cortex/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const agentSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: "نام ایجنت الزامی است." })
      .max(80, { message: "نام ایجنت حداکثر ۸۰ کاراکتر است." }),
    orgName: z.string().max(120, { message: "نام سازمان حداکثر ۱۲۰ کاراکتر است." }),
    description: z.string().max(500, { message: "توضیحات حداکثر ۵۰۰ کاراکتر است." }),
    language: z.enum(["fa", "en"]),
    tone: z.enum(["professional", "friendly", "concise", "formal", "custom"]),
    customTone: z.string().max(120, { message: "لحن سفارشی حداکثر ۱۲۰ کاراکتر است." }),
    instructions: z.string(),
    persona: z.string().max(2000, { message: "شخصیت حداکثر ۲۰۰۰ کاراکتر است." }),
    systemPrompt: z.string().max(8000, { message: "پرامپت سیستم حداکثر ۸۰۰۰ کاراکتر است." }),
    temperature: z.number().min(0).max(2),
    topP: z.number().min(0).max(1),
    maxTokens: z.number().int().min(128).max(8000),
    memoryEnabled: z.boolean(),
    citationsEnabled: z.boolean(),
  })
  .refine((values) => values.tone !== "custom" || values.customTone.trim().length > 0, {
    message: "برای لحن سفارشی، توضیح لحن را وارد کنید.",
    path: ["customTone"],
  });

type AgentFormValues = z.infer<typeof agentSchema>;

const PERSONALITY_PRESETS = [
  { label: "مشاور فروش", persona: "یک مشاور فروش حرفه‌ای، صبور و نتیجه‌گرا. ابتدا نیاز کاربر را کشف کن و سپس پیشنهاد دقیق بده.", instructions: "قبل از پیشنهاد، سؤال روشن‌کننده بپرس. مزایا و محدودیت‌ها را شفاف بگو و ادعای بدون منبع نکن." },
  { label: "پشتیبان صبور", persona: "یک پشتیبان مشتری آرام، همدل و دقیق که کاربر را مرحله‌به‌مرحله راهنمایی می‌کند.", instructions: "مشکل را ساده توضیح بده و مراحل حل را شماره‌گذاری کن. در ابهام، سؤال مشخص بپرس." },
  { label: "تحلیلگر", persona: "یک تحلیلگر داده و کسب‌وکار منطقی و ساختارمند که واقعیت، فرض و نتیجه‌گیری را جدا می‌کند.", instructions: "پاسخ را با جمع‌بندی، داده، تحلیل و اقدام بعدی ساختاربندی کن و هیچ عددی را بدون منبع نساز." },
  { label: "دستیار اجرایی", persona: "یک دستیار اجرایی سریع، منظم و مسئولیت‌پذیر که درخواست‌ها را به اقدام‌های مشخص تبدیل می‌کند.", instructions: "خروجی را عملیاتی، اولویت‌بندی‌شده و کوتاه نگه دار و همیشه قدم بعدی را روشن کن." },
  { label: "دستیار خلاق", persona: "یک شریک خلاق با ایده‌های متنوع و در عین حال منضبط که تفاوت ایده و واقعیت را حفظ می‌کند.", instructions: "چند ایده متفاوت بده، تفاوت هرکدام را کوتاه توضیح بده و از کلیشه‌ها دوری کن." },
] as const;

const TONE_OPTIONS: Array<{ value: AgentFormValues["tone"]; label: string }> = [
  { value: "professional", label: "حرفه‌ای" },
  { value: "friendly", label: "دوستانه" },
  { value: "concise", label: "مختصر" },
  { value: "formal", label: "رسمی" },
  { value: "custom", label: "سفارشی" },
];

function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs leading-relaxed text-destructive">
      {message}
    </p>
  );
}

export function AgentForm({ mode, agent }: { mode: "create" | "edit"; agent?: AgentDto | null }) {
  const setView = useCortexStore((s) => s.setView);
  const openAgent = useCortexStore((s) => s.openAgent);
  const activeWorkspaceId = useCortexStore((s) => s.activeWorkspaceId);
  const queryClient = useQueryClient();

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: agent?.name ?? "",
      orgName: agent?.orgName ?? "",
      description: agent?.description ?? "",
      language: agent?.language ?? "fa",
      tone: agent?.tone ?? "professional",
      customTone: agent?.customTone ?? "",
      instructions: agent?.instructions ?? "",
      persona: agent?.persona ?? "",
      systemPrompt: agent?.systemPrompt ?? "",
      temperature: agent?.temperature ?? 0.7,
      topP: agent?.topP ?? 1,
      maxTokens: agent?.maxTokens ?? 1200,
      memoryEnabled: agent?.memoryEnabled ?? true,
      citationsEnabled: agent?.citationsEnabled ?? true,
    },
  });

  /* Keep the form in sync when the same component instance receives fresh agent data. */
  useEffect(() => {
    form.reset({
      name: agent?.name ?? "",
      orgName: agent?.orgName ?? "",
      description: agent?.description ?? "",
      language: agent?.language ?? "fa",
      tone: agent?.tone ?? "professional",
      customTone: agent?.customTone ?? "",
      instructions: agent?.instructions ?? "",
      persona: agent?.persona ?? "",
      systemPrompt: agent?.systemPrompt ?? "",
      temperature: agent?.temperature ?? 0.7,
      maxTokens: agent?.maxTokens ?? 1200,
      memoryEnabled: agent?.memoryEnabled ?? true,
      citationsEnabled: agent?.citationsEnabled ?? true,
    });
  }, [agent, form]);

  const nameValue = useWatch({ control: form.control, name: "name" }) ?? "";
  const descriptionValue = useWatch({ control: form.control, name: "description" }) ?? "";
  const toneValue = useWatch({ control: form.control, name: "tone" });

  const createMutation = useMutation({
    mutationFn: (values: AgentFormValues) => {
      const payload: CreateAgentInput = {
        name: values.name.trim(),
        language: values.language,
        tone: values.tone,
        orgName: values.orgName.trim() || undefined,
        description: values.description.trim() || undefined,
        customTone: values.tone === "custom" ? values.customTone.trim() : undefined,
        instructions: values.instructions.trim() || undefined,
        persona: values.persona.trim() || undefined,
        systemPrompt: values.systemPrompt.trim() || undefined,
        temperature: values.temperature,
        topP: values.topP,
        maxTokens: values.maxTokens,
        memoryEnabled: values.memoryEnabled,
        citationsEnabled: values.citationsEnabled,
        workspaceId: activeWorkspaceId ?? undefined,
      };
      return api.createAgent(payload);
    },
    onSuccess: ({ agent: created }) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("ایجنت با موفقیت ساخته شد");
      openAgent(created.id, "overview");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (values: AgentFormValues) => {
      if (!agent) throw new Error("ایجنت یافت نشد.");
      const payload: UpdateAgentInput = {
        name: values.name.trim(),
        language: values.language,
        tone: values.tone,
        orgName: values.orgName.trim(),
        description: values.description.trim(),
        customTone: values.tone === "custom" ? values.customTone.trim() : "",
        instructions: values.instructions.trim(),
        persona: values.persona.trim(),
        systemPrompt: values.systemPrompt.trim(),
        temperature: values.temperature,
        maxTokens: values.maxTokens,
        memoryEnabled: values.memoryEnabled,
        citationsEnabled: values.citationsEnabled,
      };
      return api.updateAgent(agent.id, payload);
    },
    onSuccess: () => {
      if (!agent) return;
      queryClient.invalidateQueries({ queryKey: ["agent", agent.id] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("تغییرات با موفقیت ذخیره شد");
      openAgent(agent.id, "overview");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitting = createMutation.isPending || updateMutation.isPending;

  function handleCancel() {
    if (mode === "create") setView("agents");
    else if (agent) openAgent(agent.id, "overview");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">
          {mode === "create" ? "ایجاد ایجنت جدید" : `ویرایش «${agent?.name ?? ""}»`}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {mode === "create"
            ? "مشخصات ایجنت را تعیین کنید؛ بعد از ساخت، می‌توانید دانش را اضافه کرده و گفتگو را آغاز کنید."
            : "مشخصات ایجنت را به‌روزرسانی کنید. تغییرات فوراً در گفتگوهای جدید اعمال می‌شود."}
        </p>
      </div>

      <Card className="rounded-xl">
        <CardHeader className="border-b [.border-b]:pb-5">
          <CardTitle className="text-base">مشخصات ایجنت</CardTitle>
          <CardDescription>فیلدهای ستاره‌دار الزامی هستند.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form
            onSubmit={form.handleSubmit((values) => (mode === "create" ? createMutation.mutate(values) : updateMutation.mutate(values)))}
            className="space-y-6"
            noValidate
          >
            {/* نام ایجنت */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="agent-name">نام ایجنت *</Label>
                <span aria-live="polite" className="text-[11px] text-muted-foreground">
                  {nameValue.length}/۸۰
                </span>
              </div>
              <Input
                id="agent-name"
                placeholder="مثلاً دستیار فروش"
                maxLength={80}
                aria-invalid={!!form.formState.errors.name}
                aria-describedby={form.formState.errors.name ? "agent-name-error" : undefined}
                {...form.register("name")}
              />
              <FieldError id="agent-name-error" message={form.formState.errors.name?.message} />
            </div>

            {/* نام سازمان */}
            <div className="space-y-2">
              <Label htmlFor="agent-org">نام کسب‌وکار / سازمان</Label>
              <Input
                id="agent-org"
                placeholder="مثلاً شرکت ترانوس"
                maxLength={120}
                aria-invalid={!!form.formState.errors.orgName}
                aria-describedby={form.formState.errors.orgName ? "agent-org-error" : undefined}
                {...form.register("orgName")}
              />
              <FieldError id="agent-org-error" message={form.formState.errors.orgName?.message} />
            </div>

            {/* توضیحات */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="agent-description">توضیحات</Label>
                <span aria-live="polite" className="text-[11px] text-muted-foreground">
                  {descriptionValue.length}/۵۰۰
                </span>
              </div>
              <Textarea
                id="agent-description"
                rows={3}
                placeholder="این ایجنت چه کاری انجام می‌دهد و برای چه کسانی است؟"
                maxLength={500}
                aria-invalid={!!form.formState.errors.description}
                aria-describedby={form.formState.errors.description ? "agent-description-error" : undefined}
                {...form.register("description")}
              />
              <FieldError id="agent-description-error" message={form.formState.errors.description?.message} />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* زبان */}
              <div className="space-y-2">
                <Label htmlFor="agent-language">زبان پاسخ‌دهی *</Label>
                <Controller
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="agent-language" className="w-full" aria-invalid={!!form.formState.errors.language}>
                        <SelectValue placeholder="انتخاب کنید" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fa">فارسی</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* لحن */}
              <div className="space-y-2">
                <Label htmlFor="agent-tone">لحن گفتار *</Label>
                <Controller
                  control={form.control}
                  name="tone"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="agent-tone" className="w-full" aria-invalid={!!form.formState.errors.tone}>
                        <SelectValue placeholder="انتخاب کنید" />
                      </SelectTrigger>
                      <SelectContent>
                        {TONE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* لحن سفارشی */}
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.018] p-4">
              <div><p className="text-sm font-semibold text-foreground">شخصیت‌های آماده</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">یک الگو انتخاب کن و بعد همه متن‌ها را شخصی‌سازی کن.</p></div>
              <div className="flex flex-wrap gap-2">
                {PERSONALITY_PRESETS.map((preset) => (
                  <Button key={preset.label} type="button" variant="outline" size="sm" onClick={() => {
                    form.setValue("persona", preset.persona, { shouldDirty: true });
                    form.setValue("instructions", preset.instructions, { shouldDirty: true });
                  }}>{preset.label}</Button>
                ))}
              </div>
            </div>

            {toneValue === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="agent-custom-tone">لحن سفارشی *</Label>
                <Input
                  id="agent-custom-tone"
                  placeholder="مثلاً صمیمی اما محترمانه، با مثال‌های ملموس"
                  maxLength={120}
                  aria-invalid={!!form.formState.errors.customTone}
                  aria-describedby={form.formState.errors.customTone ? "agent-custom-tone-error" : undefined}
                  {...form.register("customTone")}
                />
                <FieldError id="agent-custom-tone-error" message={form.formState.errors.customTone?.message} />
              </div>
            )}

            {/* دستورالعمل‌ها */}
            <div className="space-y-2">
              <Label htmlFor="agent-instructions">دستورالعمل‌ها</Label>
              <Textarea
                id="agent-instructions"
                rows={6}
                placeholder="این ایجنت چگونه باید پاسخ دهد؟ محدودیت‌ها و سبک پاسخ را توضیح دهید."
                aria-describedby="agent-instructions-hint"
                {...form.register("instructions")}
              />
              <p id="agent-instructions-hint" className="text-xs leading-relaxed text-muted-foreground">
                مثلاً: «فقط بر اساس دانش موجود پاسخ بده. اگر پاسخ را نمی‌دانی صادقانه بگو. پاسخ‌ها کوتاه و مشخص باشد.»
              </p>
            </div>

            {/* شخصیت و تنظیمات پیشرفته */}
            <div className="space-y-5 rounded-2xl border border-primary/15 bg-primary/[.035] p-5">
              <div>
                <p className="text-sm font-semibold text-foreground">شخصیت و رفتار پیشرفته</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">هویت، قوانین رفتاری و میزان خلاقیت ایجنت را بدون نیاز به کدنویسی تنظیم کنید.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-persona">شخصیت ایجنت</Label>
                <Textarea id="agent-persona" rows={5} placeholder="مثلاً: یک مشاور فروش بااعتمادبه‌نفس، صبور و صمیمی؛ قبل از پیشنهاد محصول نیاز مشتری را کشف کن..." {...form.register("persona")} />
                <FieldError message={form.formState.errors.persona?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-system-prompt">دستور سیستم سفارشی</Label>
                <Textarea id="agent-system-prompt" rows={6} placeholder="قوانین دقیق‌تری که می‌خواهید مدل همیشه رعایت کند..." {...form.register("systemPrompt")} />
                <FieldError message={form.formState.errors.systemPrompt?.message} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2">
                  <div className="flex items-baseline justify-between"><Label htmlFor="agent-top-p">تنوع انتخاب واژه</Label><span className="text-[11px] text-muted-foreground">{form.watch("topP").toFixed(2)}</span></div>
                  <input id="agent-top-p" type="range" min="0" max="1" step="0.05" className="w-full accent-primary" {...form.register("topP", { valueAsNumber: true })} />
                  <div className="flex justify-between text-[10px] text-muted-foreground"><span>متمرکز</span><span>متنوع</span></div>
                </div>

                
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="agent-temperature">خلاقیت پاسخ</Label>
                    <span className="text-[11px] text-muted-foreground">{form.watch("temperature").toFixed(2)}</span>
                  </div>
                  <input id="agent-temperature" type="range" min="0" max="2" step="0.05" className="w-full accent-primary" {...form.register("temperature", { valueAsNumber: true })} />
                  <div className="flex justify-between text-[10px] text-muted-foreground"><span>دقیق</span><span>خلاق</span></div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agent-max-tokens">حداکثر طول پاسخ</Label>
                  <Input id="agent-max-tokens" type="number" min={128} max={8000} step={128} {...form.register("maxTokens", { valueAsNumber: true })} />
                  <p className="text-[10px] text-muted-foreground">بین ۱۲۸ تا ۸۰۰۰ توکن.</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/10 p-4">
                  <span><span className="block text-sm font-medium">حافظه مکالمه</span><span className="mt-1 block text-xs text-muted-foreground">آخرین پیام‌های گفتگو در پاسخ بعدی استفاده شوند.</span></span>
                  <input type="checkbox" className="size-4 accent-[#3b82ff]" {...form.register("memoryEnabled")} />
                </label>
                <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/10 p-4">
                  <span><span className="block text-sm font-medium">ارجاع به منابع</span><span className="mt-1 block text-xs text-muted-foreground">منبع و استناد بازیابی‌شده همراه پاسخ ثبت شود.</span></span>
                  <input type="checkbox" className="size-4 accent-[#3b82ff]" {...form.register("citationsEnabled")} />
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-start">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={submitting}>
                <ArrowRight />
                انصراف
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
                {submitting ? "در حال ذخیره..." : mode === "create" ? "ساخت ایجنت" : "ذخیره تغییرات"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function AgentBuilderView() {
  return <AgentForm mode="create" />;
}

export function AgentEditView() {
  const activeAgentId = useCortexStore((s) => s.activeAgentId);
  const setView = useCortexStore((s) => s.setView);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["agent", activeAgentId],
    queryFn: () => api.getAgent(activeAgentId as string),
    enabled: !!activeAgentId,
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[560px] rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <ErrorState
          message={error instanceof Error ? error.message : "دریافت اطلاعات ایجنت ناموفق بود."}
          onRetry={() => void refetch()}
        />
        <Button variant="outline" onClick={() => setView("agents")}>
          <ArrowRight />
          بازگشت به ایجنت‌ها
        </Button>
      </div>
    );
  }

  return <AgentForm mode="edit" agent={data.agent} />;
}
