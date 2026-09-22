/**
 * LLM provider abstraction. Business logic (RAG pipeline, chat) only ever
 * talks to this interface — providers can be swapped without touching it.
 */

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  messages: ChatTurn[];
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResult {
  content: string;
  provider: string;
  model: string;
}

export interface LLMProvider {
  readonly name: string;
  /** True when the provider is usable right now (key present etc.). */
  isConfigured(): boolean;
  /** Human-readable model identifier actually in use. */
  model(): string | null;
  /** Real generation. Throws when not configured or on transport failure. */
  generateResponse(options: GenerateOptions): Promise<GenerateResult>;
  /** Live round-trip check with a minimal prompt. */
  healthCheck(): Promise<{ ok: true; latencyMs: number; sample: string } | { ok: false; error: string }>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`سرویس‌دهنده هوش مصنوعی «${provider}» پیکربندی نشده است.`);
  }
}

export class ProviderUnavailableError extends Error {
  status = 502;
  constructor() {
    super("سرویس هوش مصنوعی در حال حاضر در دسترس نیست؛ لطفاً بعداً دوباره تلاش کنید.");
  }
}
