const FALLBACK_USD_TOMAN = 235_175;
const CACHE_MS = 15 * 60 * 1000;

type Cache = { at:number; rate:number; source:string; stale:boolean };
let cache: Cache | null = null;

function parseRateText(value: string): number | null {
  const normalized = value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٬،]/g, ",")
    .replace(/,/g, "")
    .trim();
  const n = Number(normalized);
  return Number.isFinite(n) && n > 10_000 ? n : null;
}

function candidateTomanRates(text: string): number[] {
  const out: number[] = [];
  const patterns = [
    /(?:قیمت|value|price)[^0-9۰-۹]{0,80}([0-9۰-۹][0-9۰-۹,٬،]{5,})/gi,
    /([0-9۰-۹][0-9۰-۹,٬،]{5,})[^\n]{0,80}(?:تومان|ریال|rial|toman)/gi,
  ];
  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const rial = parseRateText(match[1]);
      if (rial === null) continue;
      const toman = Math.round(rial / 10);
      if (toman >= 50_000 && toman <= 10_000_000) out.push(toman);
    }
  }
  return out;
}

export async function getUsdTomanRate() {
  const manual = Number(process.env.CORTEX_USD_TOMAN_RATE);
  if (Number.isFinite(manual) && manual >= 50_000 && manual <= 10_000_000) {
    return { usdToman: Math.round(manual), source: "CORTEX_USD_TOMAN_RATE", asOf: new Date().toISOString(), stale: false };
  }
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return { usdToman: cache.rate, source: cache.source, asOf: new Date(cache.at).toISOString(), stale: cache.stale };
  }
  try {
    const response = await fetch("https://www.tgju.org/profile/price_dollar_rl", {
      headers: { "accept-language":"fa-IR,fa;q=0.9,en;q=0.7", "user-agent":"CortexAI/1.0" },
      cache:"no-store",
    });
    if (!response.ok) throw new Error("TGJU HTTP " + response.status);
    const html = await response.text();
    const candidates = candidateTomanRates(html);
    const rate = candidates.sort((a,b)=>Math.abs(a-FALLBACK_USD_TOMAN)-Math.abs(b-FALLBACK_USD_TOMAN))[0];
    if (!rate) throw new Error("TGJU rate not parsed");
    cache = { at:Date.now(), rate, source:"TGJU free-market snapshot", stale:false };
    return { usdToman:rate, source:cache.source, asOf:new Date(cache.at).toISOString(), stale:false };
  } catch {
    cache = { at:Date.now(), rate:FALLBACK_USD_TOMAN, source:"TGJU fallback snapshot", stale:true };
    return { usdToman:FALLBACK_USD_TOMAN, source:cache.source, asOf:new Date(cache.at).toISOString(), stale:true };
  }
}
