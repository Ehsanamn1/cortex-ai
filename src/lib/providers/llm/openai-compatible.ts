import { ProviderNotConfiguredError, ProviderUnavailableError, type GenerateOptions, type GenerateResult, type LLMProvider } from './types';
import { assertPublicProviderBaseUrl, validateProviderBaseUrl } from './provider-url';

export type CompatibleAuthMode = 'bearer' | 'x-api-key' | 'none';

export interface CompatibleConfig {
  name: string;
  baseUrl: string;
  apiKey?: string | null;
  model: string;
  authMode?: CompatibleAuthMode;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly authMode: CompatibleAuthMode;
  private readonly modelId: string;

  constructor(config: CompatibleConfig) {
    this.name = config.name.trim() || 'openai-compatible';
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey?.trim() || undefined;
    this.authMode = config.authMode ?? 'bearer';
    this.modelId = config.model.trim();
  }

  isConfigured(): boolean {
    if (!this.baseUrl || !this.modelId || (this.authMode !== 'none' && !this.apiKey)) return false;
    try {
      validateProviderBaseUrl(this.baseUrl);
      return true;
    } catch {
      return false;
    }
  }

  model(): string | null {
    return this.modelId || null;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey && this.authMode === 'bearer') headers.Authorization = `Bearer ${this.apiKey}`;
    if (this.apiKey && this.authMode === 'x-api-key') headers['x-api-key'] = this.apiKey;
    return headers;
  }

  async generateResponse(options: GenerateOptions): Promise<GenerateResult> {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name);
    try {
      const base = await assertPublicProviderBaseUrl(this.baseUrl);
      const endpoint = base.toString().replace(/\/$/, '') + '/chat/completions';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: this.modelId,
          messages: options.messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 900,
        }),
        signal: AbortSignal.timeout(90_000),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`[cortex][${this.name}] HTTP ${res.status}`, text.slice(0, 300));
        throw new Error(`${this.name} http ${res.status}`);
      }
      const data = JSON.parse(text) as { choices?: Array<{ message?: { content?: string | Array<{type?: string; text?: string}> } }> };
      const raw = data.choices?.[0]?.message?.content;
      const content = Array.isArray(raw) ? raw.map((part) => part.text ?? '').join('') : raw;
      if (!content?.trim()) throw new Error('empty completion');
      return { content: content.trim(), provider: this.name, model: this.modelId };
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
        messages: [
          { role: 'system', content: 'Reply with the single word: OK' },
          { role: 'user', content: 'ping' },
        ],
        maxTokens: 8,
      });
      return { ok: true as const, latencyMs: Date.now() - started, sample: result.content.slice(0, 40) };
    } catch {
      return { ok: false as const, error: `اتصال به ${this.name} برقرار نشد.` };
    }
  }
}
