import crypto from "node:crypto";

const REGION = "auto";
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const DEFAULT_EXPIRES = 15 * 60;

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase());
}
function hmac(key: string | Uint8Array, value: string): Buffer {
  return crypto.createHmac("sha256", key).update(value).digest();
}
function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function canonicalUri(bucket: string, key: string): string {
  return "/" + [bucket, ...key.split("/")].map(awsEncode).join("/");
}
function cfg() {
  return {
    accountId: process.env.R2_ACCOUNT_ID || "",
    bucket: process.env.R2_BUCKET_NAME || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  };
}
export function isR2Configured(): boolean {
  const c = cfg();
  return Boolean(c.accountId && c.bucket && c.accessKeyId && c.secretAccessKey);
}
export function r2MaxUploadBytes(): number {
  return MAX_UPLOAD_BYTES;
}
function requireConfig() {
  const c = cfg();
  if (!c.accountId || !c.bucket || !c.accessKeyId || !c.secretAccessKey) {
    throw new Error("فضای ذخیره‌سازی R2 پیکربندی نشده است.");
  }
  return c;
}
function presignedUrl(method: "GET" | "PUT" | "HEAD" | "DELETE", key: string, expiresIn = DEFAULT_EXPIRES): string {
  const { accountId, bucket, accessKeyId, secretAccessKey } = requireConfig();
  const host = accountId + ".r2.cloudflarestorage.com";
  const amzDate = new Date().toISOString().replace(/[:-]|.d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = dateStamp + "/" + REGION + "/s3/aws4_request";
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": accessKeyId + "/" + scope,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.max(1, Math.min(604800, Math.floor(expiresIn)))),
    "X-Amz-SignedHeaders": "host",
  };
  const encodedQuery = () => Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => awsEncode(k) + "=" + awsEncode(v)).join("&");
  const uri = canonicalUri(bucket, key);
  const canonicalRequest = [
    method,
    uri,
    encodedQuery(),
    "host:" + host + "\n",
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const kDate = hmac("AWS4" + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  query["X-Amz-Signature"] = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  return "https://" + host + uri + "?" + encodedQuery();
}
export function createR2PresignedPut(key: string, expiresIn = DEFAULT_EXPIRES): string {
  return presignedUrl("PUT", key, expiresIn);
}
export function createR2PresignedGet(key: string, expiresIn = DEFAULT_EXPIRES): string {
  return presignedUrl("GET", key, expiresIn);
}
export async function getR2ObjectBytes(key: string): Promise<Uint8Array> {
  const response = await fetch(createR2PresignedGet(key, 5 * 60));
  if (!response.ok) throw new Error("دریافت فایل از فضای ذخیره‌سازی ناموفق بود.");
  return new Uint8Array(await response.arrayBuffer());
}
export async function headR2Object(key: string): Promise<{ size: number; contentType: string }> {
  const response = await fetch(presignedUrl("HEAD", key, 5 * 60));
  if (!response.ok) throw new Error("فایل بارگذاری‌شده در فضای ذخیره‌سازی پیدا نشد.");
  return {
    size: Number(response.headers.get("content-length") || 0),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}
export async function deleteR2Object(key: string): Promise<void> {
  if (!isR2Configured()) return;
  await fetch(presignedUrl("DELETE", key, 5 * 60), { method: "DELETE" }).catch(() => undefined);
}
