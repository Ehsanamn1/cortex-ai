const PRIVATE_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "metadata.google.internal",
  "instance-data",
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

export function isPrivateIp(ip: string): boolean {
  const value = ip.trim().replace(/^\[|\]$/g, "").toLowerCase();
  if (value === "::1" || value === "0:0:0:0:0:0:0:1") return true;

  const firstHextet = Number.parseInt(value.split(":")[0] || "", 16);
  if (
    Number.isFinite(firstHextet) &&
    ((firstHextet >= 0xfc00 && firstHextet <= 0xfdff) ||
      (firstHextet >= 0xfe80 && firstHextet <= 0xfebf))
  ) {
    return true;
  }

  const mappedIpv4 = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  if (mappedIpv4 && isPrivateIp(mappedIpv4)) return true;

  const numeric = ipv4ToInt(value);
  if (numeric === null) return false;

  const first = numeric >>> 24;
  if (first === 127 || first === 0 || first === 10) return true;
  if ((numeric >>> 20) === 0xAC1) return true; // 172.16.0.0/12
  if ((numeric >>> 16) === 0xC0A8) return true; // 192.168.0.0/16
  if ((numeric >>> 16) === 0xA9FE) return true; // 169.254.0.0/16
  return false;
}

export class UnsafeProviderUrlError extends Error {
  status = 400;
  constructor() {
    super("Base URL سرویس‌دهنده مجاز نیست.");
  }
}

export function validateProviderBaseUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UnsafeProviderUrlError();
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeProviderUrlError();

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.length > 253) throw new UnsafeProviderUrlError();
  if (PRIVATE_HOSTNAMES.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UnsafeProviderUrlError();
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    if (isPrivateIp(host)) throw new UnsafeProviderUrlError();
  }

  return url;
}
