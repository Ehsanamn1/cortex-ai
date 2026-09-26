import { ProviderNotConfiguredError, type GenerateOptions, type GenerateResult, type LLMProvider } from "./types";
import { assertPublicProviderBaseUrl, validateProviderBaseUrl } from "./provider-url";
import { fetchProviderResponse } from "./request";

export interface AnthropicConfig {
  name: string;
  baseUrl: string;
  apiKey?: string | null;
  model: string;
}

export class AnthropicProvider implements LLMProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly modelId: string;

  constructor(config: AnthropicConfig) {
    this.name = config.name.trim() || "anthropic";
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

  private endpoint() {
    return this.baseUrl.endsWith("/messages") ? this.baseUrl : this.baseUrl + "/messages";
  }

  async generateResponse(options: GenerateOptions): Promise<GenerateResult> {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name);

    try {
      const base = await assertPublicProviderBaseUrl(this.baseUrl);
      const endpoint = base.toString().endsWith("/messages")
        ? base.toString()
        : base.toString().replace(/\/$/, "") + "/messages";
      const system = options.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
      const messages = options.messages
        .filter((message) => message.role !== "system")
        .map((message) => ({ role: message.role, content: message.content }));

      const response = await fetchProviderResponse(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.modelId,
          max_tokens: options.maxTokens ?? 900,
          temperature: options.temperature ?? 0.3,
          ...(system ? { system } : {}),
          messages,
        }),
      }, this.name);

      const data = await response.json() as {
        content?: Array<{ type?: string; text?: string }>;
      };
      const content = data.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("");
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
