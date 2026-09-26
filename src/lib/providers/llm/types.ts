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

export type ProviderErrorCode =
  | "provider_timeout"
  | "provider_429"
  | "provider_5xx"
  | "provider_auth_failed"
  | "provider_4xx"
  | "provider_dns_failure"
  | "provider_network"
  | "provider_invalid_response"
  | "provider_empty_response"
  | "provider_disabled"
  | "provider_circuit_open"
  | "provider_unknown";

export class ProviderUnavailableError extends Error {
  readonly status = 502;
  readonly code: ProviderErrorCode;
  readonly provider?: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly rawStatus?: number;
  readonly causeMessage?: string;

  constructor(params: {
    code?: ProviderErrorCode;
    provider?: string;
    rawStatus?: number;
    retryable?: boolean;
    retryAfterMs?: number;
    message?: string;
    causeMessage?: string;
  } = {}) {
    super(params.message ?? "سرویس هوش مصنوعی در حال حاضر در دسترس نیست؛ لطفاً بعداً دوباره تلاش کنید.");
    this.name = "ProviderUnavailableError";
    this.code = params.code ?? "provider_unknown";
    this.provider = params.provider;
    this.rawStatus = params.rawStatus;
    this.retryable = params.retryable ?? false;
    this.retryAfterMs = params.retryAfterMs;
    this.causeMessage = params.causeMessage;
  }
}

export function classifyProviderFailure(
  error: unknown,
  provider: string,
): ProviderUnavailableError {
  if (error instanceof ProviderUnavailableError) return error;

  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (/401|403|unauthorized|forbidden|invalid api key|authentication/i.test(message) || status === 401 || status === 403) {
    return new ProviderUnavailableError({
      code: "provider_auth_failed",
      provider,
      rawStatus: status,
      retryable: false,
      causeMessage: message,
    });
  }
  if (status === 429 || /(?:\b429\b|rate.?limit|too many requests|quota)/i.test(message)) {
    return new ProviderUnavailableError({
      code: "provider_429",
      provider,
      rawStatus: status,
      retryable: true,
      causeMessage: message,
    });
  }
  if (status && status >= 500) {
    return new ProviderUnavailableError({
      code: "provider_5xx",
      provider,
      rawStatus: status,
      retryable: true,
      causeMessage: message,
    });
  }
  if (status && status >= 400) {
    return new ProviderUnavailableError({
      code: "provider_4xx",
      provider,
      rawStatus: status,
      retryable: false,
      causeMessage: message,
    });
  }
  if (/timed out|timeout|abort/i.test(message)) {
    return new ProviderUnavailableError({
      code: "provider_timeout",
      provider,
      retryable: true,
      causeMessage: message,
    });
  }
  if (/dns|enotfound|getaddrinfo|name or service not known/i.test(message)) {
    return new ProviderUnavailableError({
      code: "provider_dns_failure",
      provider,
      retryable: true,
      causeMessage: message,
    });
  }
  if (/fetch failed|network|socket|connection/i.test(message)) {
    return new ProviderUnavailableError({
      code: "provider_network",
      provider,
      retryable: true,
      causeMessage: message,
    });
  }
  if (/json|unexpected token|malformed|invalid response|choices|candidates|completion/i.test(message)) {
    return new ProviderUnavailableError({
      code: /empty completion/i.test(message) ? "provider_empty_response" : "provider_invalid_response",
      provider,
      retryable: false,
      causeMessage: message,
    });
  }
  return new ProviderUnavailableError({
    code: "provider_unknown",
    provider,
    retryable: false,
    causeMessage: message,
  });
}
