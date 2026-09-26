import { ProviderNotConfiguredError, ProviderUnavailableError, type GenerateOptions, type GenerateResult, type LLMProvider } from "./types";
import { assertPublicProviderBaseUrl, validateProviderBaseUrl } from "./provider-url";

export class GeminiProvider implements LLMProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly modelId: string;

  constructor(config: { name: string; baseUrl: string; apiKey?: string | null; model: string }) {
    this.name = config.name.trim() || "google-gemini";
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey?.trim() || undefined;
    this.modelId = config.model.trim();
  }

  isConfigured(): boolean {
    if (!this.baseUrl || !this.modelId || !this.apiKey) return false;
    try { validateProviderBaseUrl(this.baseUrl); return true; } catch { return false; }
  }

  model() { return this.modelId || null; }

  async generateResponse(options: GenerateOptions): Promise<GenerateResult> {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name);
    try {
      const base = await assertPublicProviderBaseUrl(this.baseUrl);
      const contents = options.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
      const system = options.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const url = new URL(base.toString().replace(/\/$/, "") + "/v1beta/models/" + encodeURIComponent(this.modelId) + ":generateContent");
      url.searchParams.set("key", this.apiKey!);
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents,
          generationConfig: {
            temperature: options.temperature ?? 0.3,
            maxOutputTokens: options.maxTokens ?? 900,
          },
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const body = await res.text();
      if (!res.ok) throw new Error(`${this.name} http ${res.status}: ${body.slice(0, 180)}`);
      const data = JSON.parse(body) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (!content) throw new Error("empty completion");
      return { content, provider: this.name, model: this.modelId };
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError) throw error;
      console.error(`[cortex][${this.name}] generation failed`, error instanceof Error ? error.message : error);
      throw new ProviderUnavailableError();
    }
  }

  async healthCheck() {
    const started = Date.now();
    try {
      const result = await this.generateResponse({
        messages: [{ role: "user", content: "Reply with the single word: OK" }],
        maxTokens: 8,
      });
      return { ok: true as const, latencyMs: Date.now() - started, sample: result.content.slice(0, 40) };
    } catch {
      return { ok: false as const, error: `اتصال به ${this.name} برقرار نشد.` };
    }
  }
}
