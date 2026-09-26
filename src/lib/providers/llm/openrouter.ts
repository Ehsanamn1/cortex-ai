import {
  ProviderNotConfiguredError,
  ProviderUnavailableError,
  type GenerateOptions,
  type GenerateResult,
  type LLMProvider,
} from "./types";
import { fetchProviderResponse } from "./request";

/**
 * OpenRouter provider — real, standard OpenAI-compatible REST.
 * Active whenever OPENROUTER_API_KEY is configured (LLM_PROVIDER=openrouter).
 */
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export class OpenRouterProvider implements LLMProvider {
  readonly name = "openrouter";

  private apiKey(): string | undefined {
    const key = process.env.OPENROUTER_API_KEY?.trim();
    return key && key.length > 0 ? key : undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  model(): string | null {
    return process.env.LLM_MODEL?.trim() || process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini";
  }

  async generateResponse(options: GenerateOptions): Promise<GenerateResult> {
    const key = this.apiKey();
    if (!key) throw new ProviderNotConfiguredError(this.name);
    const model = this.model()!;
    try {
      const res = await fetchProviderResponse(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_PUBLIC_URL ?? "http://localhost:3000",
          "X-Title": "Cortex AI",
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 900,
        }),
      }, this.name);
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim().length === 0) {
        throw new Error("empty completion");
      }
      return { content: content.trim(), provider: this.name, model };
    } catch (e) {
      if (e instanceof ProviderNotConfiguredError || e instanceof ProviderUnavailableError) throw e;
      console.error("[cortex][openrouter] generation failed:", e instanceof Error ? e.message : e);
      throw new ProviderUnavailableError("OpenRouter پاسخ نامعتبر برگرداند.", 502);
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
      return { ok: false as const, error: "اتصال به OpenRouter برقرار نشد." };
    }
  }
}
