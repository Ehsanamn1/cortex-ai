import { db } from "@/lib/db";

/**
 * Text extraction for knowledge sources. Everything here is REAL:
 * PDF via unpdf (per page), DOCX via mammoth, TXT direct decode,
 * websites via SSRF-guarded fetch + readability-style HTML extraction.
 */

export interface ExtractedPage {
  text: string;
  page?: number; // available for PDFs
  section?: string | null;
}

export interface ExtractionResult {
  pages: ExtractedPage[];
  mimeType?: string;
  sizeBytes?: number;
}

export const UPLOAD_ROOT = ".data/uploads";

export function sanitizeFilename(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? name).replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "_").trim();
  return base.length > 0 ? base.slice(0, 180) : "file";
}

export async function persistUpload(sourceId: string, originalName: string, bytes: Uint8Array): Promise<string> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), UPLOAD_ROOT, sourceId);
  await fs.mkdir(dir, { recursive: true });
  const safe = `${crypto.randomUUID()}-${sanitizeFilename(originalName)}`;
  const filePath = path.join(dir, safe);
  await fs.writeFile(filePath, bytes);
  return filePath;
}

export async function removeUploadDir(sourceId: string): Promise<void> {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.rm(path.join(process.cwd(), UPLOAD_ROOT, sourceId), { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

/* ---------------- validation ---------------- */

export const ALLOWED_EXTENSIONS = [
  ".pdf", ".txt", ".docx", ".md", ".csv", ".json", ".xml", ".html", ".htm",
  ".yaml", ".yml", ".log", ".tsv", ".sql", ".jsonl", ".ndjson", ".rst", ".toml", ".ini", ".conf", ".env", ".css", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs", ".php", ".rb", ".sh", ".bat", ".ps1", ".graphql", ".gql"
] as const;

export function detectExtension(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
}

/** Magic-byte sniffing so a renamed binary can't pose as a document. */
export function sniffKind(bytes: Uint8Array): "pdf" | "docx-zip" | "text" | "unknown" {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "pdf"; // %PDF-
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)) {
    return "docx-zip"; // PK.. (zip container — docx)
  }
  // Heuristic: reject if NUL bytes present in the first 4KB (binary)
  const probe = bytes.subarray(0, Math.min(4096, bytes.length));
  for (const b of probe) {
    if (b === 0) return "unknown";
  }
  return "text";
}

/* ---------------- normalization ---------------- */

export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ---------------- extractors ---------------- */

export async function extractPdf(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  const pageTexts = Array.isArray(text) ? text : [String(text ?? "")];
  const pages: ExtractedPage[] = [];
  pageTexts.forEach((t, i) => {
    const normalized = normalizeText(typeof t === "string" ? t : "");
    if (normalized.length > 0) pages.push({ text: normalized, page: i + 1 });
  });
  return pages;
}

export async function extractDocx(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const mammoth = await import("mammoth");
  const buffer = Buffer.from(bytes);
  const result = await mammoth.extractRawText({ buffer });
  const normalized = normalizeText(result.value ?? "");
  return normalized.length > 0 ? [{ text: normalized, section: null }] : [];
}

export async function extractTxt(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const normalized = normalizeText(decoded);
  return normalized.length > 0 ? [{ text: normalized, section: null }] : [];
}

/* ---------------- URL ingestion (SSRF-guarded) ---------------- */

const PRIVATE_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "metadata.google.internal",
  "instance-data",
]);

function ipv4ToInt(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return (((parts[0]! * 256 + parts[1]!) * 256 + parts[2]!) * 256 + parts[3]!);
}

export function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true; // ipv6 private/link-local
  const v4 = ipv4ToInt(ip);
  if (v4 === null) return false;
  if (v4 >>> 24 === 127) return true; // loopback
  if (v4 >>> 24 === 10) return true; // 10/8
  if ((v4 >>> 20) === (172 << 4) + 1) return true; // 172.16/12
  if ((v4 >>> 16) === (192 << 8) + 168) return true; // 192.168/16
  if ((v4 >>> 16) === (169 << 8) + 254) return true; // link-local
  if (v4 >>> 24 === 0) return true; // 0/8
  return false;
}

export class UnsafeUrlError extends Error {
  status = 400;
  constructor() {
    super("این آدرس مجاز نیست. تنها آدرس‌های عمومی http/https قابل افزودن هستند.");
  }
}

export function validateUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UnsafeUrlError();
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError();
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (PRIVATE_HOSTNAMES.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UnsafeUrlError();
  }
  // Literal IP hosts must be public
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    if (isPrivateIp(host)) throw new UnsafeUrlError();
  }
  if (host === "" || host.length > 253) throw new UnsafeUrlError();
  return url;
}

async function assertPublicHost(hostname: string): Promise<void> {
  // Local Node development can use the native resolver; production Workers use
  // DNS-over-HTTPS so we never depend on a partially-polyfilled node:dns API.
  if (process.env.NODE_ENV !== "production") {
    try {
      const dns = await import("node:dns");
      const resolved = await Promise.allSettled([
        dns.promises.resolve4(hostname),
        dns.promises.resolve6(hostname),
      ]);
      const addresses = resolved.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
      if (addresses.length === 0) throw new UnsafeUrlError();
      if (addresses.some(isPrivateIp)) throw new UnsafeUrlError();
      return;
    } catch (e) {
      if (e instanceof UnsafeUrlError) throw e;
      // Fall through to DNS-over-HTTPS if the local runtime has no DNS module.
    }
  }

  const lookups = await Promise.all(
    ["A", "AAAA"].map(async (type) => {
      const endpoint =
        "https://cloudflare-dns.com/dns-query?name=" +
        encodeURIComponent(hostname) +
        "&type=" +
        type;
      const response = await fetch(endpoint, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new UnsafeUrlError();
      const payload = (await response.json()) as {
        Status?: number;
        Answer?: Array<{ type?: number; data?: string }>;
      };
      if ((payload.Status ?? 2) !== 0) return [];
      return (payload.Answer ?? [])
        .filter((record) => record.type === (type === "A" ? 1 : 28) && typeof record.data === "string")
        .map((record) => record.data as string);
    })
  );
  const addresses = lookups.flat();
  if (addresses.length === 0 || addresses.some(isPrivateIp)) throw new UnsafeUrlError();
}

const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;

async function guardedFetch(url: URL, depth = 0): Promise<Response> {
  if (depth > 4) throw new UnsafeUrlError();
  await assertPublicHost(url.hostname);
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "User-Agent": "CortexAI-KnowledgeBot/1.0 (+knowledge-ingestion)",
        Accept: "text/html,application/xhtml+xml,text/plain,application/pdf;q=0.9,*/*;q=0.5",
      },
    });
  } catch {
    throw new Error("دریافت محتوای وب‌سایت با شکست مواجه شد (تایم‌اوت یا خطای شبکه).");
  }
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const location = res.headers.get("location");
    if (!location) throw new Error("وب‌سایت پاسخ redirect نامعتبر داد.");
    const next = new URL(location, url);
    return guardedFetch(next, depth + 1);
  }
  return res;
}

export async function extractFromUrl(rawUrl: string): Promise<{
  pages: ExtractedPage[];
  finalUrl: string;
  mimeType: string;
}> {
  const url = validateUrl(rawUrl);
  const res = await guardedFetch(url);
  if (!res.ok) {
    throw new Error(`وب‌سایت با کد وضعیت ${res.status} پاسخ داد و محتوایی برای پردازش نبود.`);
  }
  const declaredLength = Number(res.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_DOWNLOAD_BYTES) {
    throw new Error("حجم محتوای وب‌سایت بیش از حد مجاز (۵ مگابایت) است.");
  }
  const buffer = new Uint8Array(await res.arrayBuffer());
  if (buffer.length > MAX_DOWNLOAD_BYTES) {
    throw new Error("حجم محتوای وب‌سایت بیش از حد مجاز (۵ مگابایت) است.");
  }
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const finalUrl = res.url || url.toString();

  if (contentType === "application/pdf") {
    return { pages: await extractPdf(buffer), finalUrl, mimeType: contentType };
  }
  if (contentType.startsWith("text/plain")) {
    const normalized = normalizeText(new TextDecoder("utf-8", { fatal: false }).decode(buffer));
    return {
      pages: normalized.length > 0 ? [{ text: normalized, section: null }] : [],
      finalUrl,
      mimeType: contentType,
    };
  }
  if (contentType.includes("html") || contentType.includes("xml") || contentType === "") {
    const pages = await extractReadableHtml(new TextDecoder("utf-8", { fatal: false }).decode(buffer));
    return { pages, finalUrl, mimeType: contentType || "text/html" };
  }
  throw new Error(`نوع محتوای پشتیبانی‌نشده: ${contentType || "نامشخص"}`);
}

/** Readability-style extraction: strip noise, prefer main/article, keep headings as sections. */
export async function extractReadableHtml(html: string): Promise<ExtractedPage[]> {
  const { load } = await import("cheerio");
  const $ = load(html);
  $("script, style, noscript, svg, iframe, nav, footer, header, aside, form, button, template").remove();
  $("[aria-hidden='true'], .nav, .menu, .sidebar, .footer, .header, .breadcrumb, .advertisement, .ads, .social, .share, .comment, .popup, .modal").remove();

  const container =
    $("main").first().length > 0
      ? $("main").first()
      : $("article").first().length > 0
        ? $("article").first()
        : $('[role="main"]').first().length > 0
          ? $('[role="main"]').first()
          : $("body");

  // Build sections from headings; fall back to a single section.
  const sections: Array<{ section: string | null; text: string }> = [];
  let currentSection: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const joined = normalizeText(buffer.join("\n"));
    if (joined.length > 0) sections.push({ section: currentSection, text: joined });
    buffer = [];
  };

  container.find("h1, h2, h3, h4, h5, h6, p, li, td, pre, blockquote").each((_i, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "p";
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text) return;
    if (/^h[1-4]$/.test(tag) && text.length < 120) {
      flush();
      currentSection = text;
      return;
    }
    buffer.push(text);
  });
  flush();

  if (sections.length === 0) {
    const whole = normalizeText(container.text());
    if (whole.length > 0) sections.push({ section: null, text: whole });
  }
  return sections.filter((s) => s.text.length >= 24).map((s) => ({ text: s.text, section: s.section }));
}

/* ---------------- dispatch for stored uploads ---------------- */

export async function extractStoredBytes(bytes: Uint8Array, originalName: string): Promise<ExtractionResult> {
  const ext = detectExtension(originalName);
  const kind = sniffKind(bytes);

  if (ext === ".pdf" && kind === "pdf") {
    return { pages: await extractPdf(bytes), mimeType: "application/pdf", sizeBytes: bytes.length };
  }
  if (ext === ".docx" && kind === "docx-zip") {
    return { pages: await extractDocx(bytes), mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: bytes.length };
  }
  const textExtensions = new Set([".txt", ".md", ".csv", ".json", ".xml", ".html", ".htm", ".yaml", ".yml", ".log", ".tsv", ".sql", ".jsonl", ".ndjson", ".rst", ".toml", ".ini", ".conf", ".env", ".css", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs", ".php", ".rb", ".sh", ".bat", ".ps1", ".graphql", ".gql"]);
  if ((textExtensions.has(ext) || kind === "text") && (kind === "text" || kind === "unknown")) {
    const mimeType =
      ext === ".json" ? "application/json" :
      ext === ".csv" ? "text/csv" :
      ext === ".html" || ext === ".htm" ? "text/html" :
      ext === ".xml" ? "application/xml" :
      "text/plain";
    return { pages: await extractTxt(bytes), mimeType, sizeBytes: bytes.length };
  }
  throw new Error("قالب فایل برای استخراج دانش متنی پشتیبانی نمی‌شود.");
}

export async function extractStoredFile(
  filePath: string,
  originalName: string
): Promise<ExtractionResult> {
  const fs = await import("node:fs/promises");
  const bytes = new Uint8Array(await fs.readFile(filePath));
  return extractStoredBytes(bytes, originalName);
}
/** Extract source-type from stored document row (used by retry). */
export async function documentForSource(sourceId: string) {
  return db.knowledgeDocument.findFirst({ where: { sourceId } });
}
