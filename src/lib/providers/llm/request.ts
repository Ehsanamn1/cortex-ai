import { ProviderUnavailableError } from "./types";

const DEFAULT_TIMEOUT_MS = 35_000;
const DEFAULT_RETRIES = 2;

function positiveInt(raw: string | undefined, fallback: number, max: number) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.min(max, Math.floor(value)) : fallback;
}

function retryDelay(attempt: number) {
  return Math.min(1_500, 250 * 2 ** attempt + Math.floor(Math.random() * 120));
}

function safeUpstreamMessage(status: number, provider: string) {
  if (status === 401 || status === 403) return `کلید یا احراز هویت سرویس «${provider}» معتبر نیست.`;
  if (status === 404) return `آدرس یا مدل سرویس «${provider}» پیدا نشد.`;
  if (status === 429) return `سرویس «${provider}» درخواست‌های زیادی دریافت کرده است. کمی بعد دوباره تلاش می‌کنیم.`;
  if (status >= 500) return `سرویس «${provider}» موقتاً پاسخ‌گو نیست.`;
  return `سرویس «${provider}» درخواست Cortex را نپذیرفت.`;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export async function fetchProviderResponse(
  input: RequestInfo | URL,
  init: RequestInit,
  provider: string,
): Promise<Response> {
  const timeoutMs = positiveInt(process.env.CORTEX_LLM_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 90_000);
  const retries = positiveInt(process.env.CORTEX_LLM_RETRIES, DEFAULT_RETRIES, 4);
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.ok) return response;

      const body = await response.text();
      if (!isRetryableStatus(response.status) || attempt >= retries) {
        console.error(`[cortex][${provider}] upstream HTTP ${response.status}`, body.slice(0, 300));
        const error = new ProviderUnavailableError(safeUpstreamMessage(response.status, provider), response.status === 429 ? 429 : 502);
        throw error;
      }

      console.warn(`[cortex][${provider}] retryable HTTP ${response.status}, attempt ${attempt + 1}/${retries + 1}`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt)));
    } catch (error) {
      lastError = error;

      if (error instanceof ProviderUnavailableError) {
        if (error.status === 429 || !isRetryableStatus(error.status) || attempt >= retries) throw error;
      } else if (attempt >= retries) {
        break;
      }

      console.warn(
        `[cortex][${provider}] upstream request failed; retry ${attempt + 1}/${retries}`,
        error instanceof Error ? error.message : error,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt)));
    }
  }

  throw new ProviderUnavailableError(
    `سرویس «${provider}» بعد از چند تلاش هنوز پاسخ‌گو نیست. وضعیت اتصال و کلید API را بررسی کنید.`,
    503,
  );
}
