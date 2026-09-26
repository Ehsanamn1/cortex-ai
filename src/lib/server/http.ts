import { NextResponse } from "next/server";

/** Standard JSON error body: { error, requestId }. */
export function jsonError(message: string, status: number, requestId?: string): NextResponse {
  return NextResponse.json({ error: message, ...(requestId ? { requestId } : {}) }, { status });
}

export function jsonOk<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

/** Apply CORS from CORS_ORIGINS env (comma-separated). Same-origin by default. */
export function applyCors(response: NextResponse, origin: string | null): NextResponse {
  const allowed = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (origin && (allowed.includes(origin) || allowed.includes("*"))) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, X-API-Key, X-Cortex-Client-Id, X-Cortex-Conversation-Id"
    );
    response.headers.set("Access-Control-Max-Age", "600");
    response.headers.set("Vary", "Origin");
  }
  return response;
}

export function corsPreflight(req: Request): NextResponse {
  return applyCors(new NextResponse(null, { status: 204 }), req.headers.get("origin"));
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "بدنه درخواست معتبر نیست.");
  }
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function clientIp(req: Request): string {
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function correlationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function toErrorResponse(e: unknown, origin: string | null = null): NextResponse {
  const requestId = correlationId();
  if (e instanceof HttpError) {
    console.warn("[cortex][http]", JSON.stringify({ requestId, status: e.status, message: e.message }));
    return applyCors(jsonError(e.message, e.status, requestId), origin);
  }
  if (e instanceof Error && typeof (e as Error & { status?: number }).status === "number") {
    const status = (e as Error & { status: number }).status;
    console.warn("[cortex][http]", JSON.stringify({ requestId, status, message: e.message }));
    return applyCors(jsonError(e.message, status, requestId), origin);
  }
  console.error("[cortex][http]", JSON.stringify({
    requestId,
    status: 500,
    error: e instanceof Error ? e.stack ?? e.message : String(e),
  }));
  return applyCors(
    jsonError("خطای غیرمنتظره‌ای در سرور رخ داد. لطفاً دوباره تلاش کنید.", 500, requestId),
    origin
  );
}
