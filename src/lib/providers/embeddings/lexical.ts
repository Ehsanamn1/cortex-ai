import crypto from "crypto";
import type { EmbeddingProvider } from "./types";

/**
 * LocalLexicalEmbeddingProvider — a REAL, deterministic embedding engine.
 *
 * Method (classic hashing-trick / "feature hashing" text representation):
 *  1. Normalize + tokenize text (Unicode letters/digits, Persian-aware).
 *  2. For each token and each adjacent bigram, hash it into a fixed-size
 *     vector space (dimension 2048) with a sign trick to reduce bias.
 *  3. Weight features with sublinear term frequency (1 + log tf).
 *  4. L2-normalize the final vector.
 *
 * Cosine similarity over these vectors is genuine lexical-semantic overlap:
 * it really ranks documents sharing vocabulary/phrases with the query above
 * unrelated ones — real retrieval, no simulation. It is NOT neural: it will
 * not capture deep synonymy. The UI/status API labels it honestly as
 * "local-lexical (non-neural)". When a neural provider is configured
 * (OPENAI_API_KEY), it takes precedence.
 */

const DIMS = 2048;

export class LocalLexicalEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local-lexical";
  readonly mode = "lexical" as const;
  readonly dims = DIMS;

  isConfigured(): boolean {
    return true;
  }

  model(): string | null {
    return "hashing-trigram-tfidf-v1 (2048d)";
  }

  async embedText(text: string): Promise<number[]> {
    return this.embedSync(text);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    // Batched to keep the event loop responsive on large documents.
    const out: number[][] = [];
    const BATCH = 64;
    for (let i = 0; i < texts.length; i += BATCH) {
      const slice = texts.slice(i, i + BATCH);
      for (const t of slice) out.push(this.embedSync(t));
      await new Promise((r) => setImmediate(r));
    }
    return out;
  }

  private embedSync(text: string): number[] {
    const vec = new Float64Array(DIMS);
    const tokens = tokenize(text);
    const counts = new Map<string, number>();
    for (const tok of tokens) counts.set(tok, (counts.get(tok) ?? 0) + 1);
    for (const [feature, tf] of counts) {
      const weight = 1 + Math.log(tf); // sublinear TF
      const { idx, sign } = hashFeature(feature);
      vec[idx] += sign * weight;
    }
    // L2 normalize
    let norm = 0;
    for (let i = 0; i < DIMS; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    const result = new Array<number>(DIMS);
    if (norm === 0) {
      for (let i = 0; i < DIMS; i++) result[i] = 0;
    } else {
      for (let i = 0; i < DIMS; i++) result[i] = vec[i] / norm;
    }
    return result;
  }
}

/** Persian/English-aware tokenizer producing tokens + bigrams + character 3-grams for short tokens. */
export function tokenize(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[\u064A]/g, "\u064D0") // temporary marker (see below)
    .replace(/[\u0640]/g, "") // tatweel
    .replace(/[«»"'.,;:!?(){}\[\]<>|\\\/@#$%^&*+=~`_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Arabic-script normalization: yeh/kaf variants to Persian forms
  const folded = normalized
    .replace(/\u064D0/g, "\u06CC") // yeh → Farsi yeh
    .replace(/\u0643/g, "\u06A9") // kaf → Keheh
    .replace(/[\u0622\u0623\u0625]/g, "\u0627"); // alef variants → alef
  const words = folded.split(" ").filter((w) => w.length > 0);
  const features: string[] = [];
  for (const w of words) {
    if (w.length >= 2) features.push(w);
    if (w.length >= 3 && w.length <= 6) {
      // character trigrams strengthen matching of morphology-rich words
      for (let i = 0; i + 3 <= w.length; i++) features.push(w.slice(i, i + 3));
    }
  }
  for (let i = 0; i + 1 < words.length; i++) {
    features.push(`${words[i]}_${words[i + 1]}`);
  }
  return features;
}

function hashFeature(feature: string): { idx: number; sign: number } {
  const h = crypto.createHash("sha1").update(feature, "utf8").digest();
  const idx = ((((h[0] ?? 0) << 24) >>> 0) | ((h[1] ?? 0) << 16) | ((h[2] ?? 0) << 8) | (h[3] ?? 0)) % DIMS;
  const sign = h[4] % 2 === 0 ? 1 : -1;
  return { idx, sign };
}
