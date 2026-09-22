import { clientIp } from "./http";

/**
 * In-memory sliding-window rate limiter (Phase 1 foundation).
 * Best-effort per Worker isolate; global distributed rate limiting can be added at the edge/provider layer.
 */
interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < 300_000);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export class RateLimitError extends Error {
  status = 429;
  constructor() {
    super("تعداد درخواست‌ها زیاد است؛ لطفاً کمی صبر کنید و دوباره تلاش کنید.");
  }
}

export function rateLimit(req: Request, scope: string, limit: number, windowMs: number): void {
  const now = Date.now();
  sweep(now);
  const key = `${scope}:${clientIp(req)}`;
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    throw new RateLimitError();
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
}
