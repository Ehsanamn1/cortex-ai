import { ProviderNotConfiguredError, type GenerateOptions, type GenerateResult, type LLMProvider } from "./types";
import { assertPublicProviderBaseUrl, validateProviderBaseUrl } from "./provider-url";
import { fetchProviderResponse } from "./request";

export interface GeminiConfig {
  name: string;
  baseUrl: string;
  apiKey?: string | null;
  model: string;
}

export class GeminiProvider implements LLMProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly modelId: string;

  constructor(config: GeminiConfig) {
    this.name = config.name.trim() || "gemini";
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey?.trim() || undefined;
    this.modelId = config.model.trim();
  }

  isConfigured() {
    if (!this.baseUrl || !this.modelId || !this.apiKey) return false;
    try {
      validateProviderBaseUrl(this.baseUrl);
      return true;
    } catch {
      return false;
    }
  }

  model() {
    return this.modelId || null;
  }

  async generateResponse(options: GenerateOptions): Promise<GenerateResult> {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name);

    try {
      const base = await assertPublicProviderBaseUrl(this.baseUrl);
      const endpoint = new URL(
        `${base.toString().replace(/\/$/, "")}/models/${encodeURIComponent(this.modelId)}:generateContent`,
      );
      endpoint.searchParams.set("key", this.apiKey!);

      const system = options.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
      const contents = options.messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        }));

      const response = await fetchProviderResponse(endpoint, {
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
      }, this.name);

      const data = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
      if (!content?.trim()) throw new Error("empty completion");
      return { content: content.trim(), provider: this.name, model: this.modelId };
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError || error instanceof Error && "status" in error) throw error;
      console.error(`[cortex][${this.name}] generation failed`, error instanceof Error ? error.message : error);
      throw new Error(`[cortex][${this.name}] generation failed`);
    }
  }

  async healthCheck() {
    const started = Date.now();
    try {
      const result = await this.generateResponse({
        messages: [
          { role: "system", content: "Reply with the single word: OK" },
          { role: "user", content: "ping" },
        ],
        maxTokens: 8,
      });
      return { ok: true as const, latencyMs: Date.now() - started, sample: result.content.slice(0, 40) };
    } catch {
      return { ok: false as const, error: `اتصال به ${this.name} برقرار نشد.` };
    }
  }
}
