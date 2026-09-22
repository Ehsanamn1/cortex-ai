/**
 * Embedding provider abstraction. Two real implementations exist:
 * - OpenAIEmbeddingProvider: neural embeddings via any OpenAI-compatible
 *   endpoint (configured with OPENAI_API_KEY / EMBEDDINGS_MODEL).
 * - LocalLexicalEmbeddingProvider: a real deterministic feature-hashing
 *   vector space (tokens + bigrams, sublinear TF, L2-normalized) with true
 *   cosine similarity. Always available, always honestly labeled as lexical
 *   (non-neural). It is NOT a placeholder and never fabricates vectors.
 */

export interface EmbeddingProvider {
  readonly name: string;
  /** "neural" for model-backed providers, "lexical" for the local engine. */
  readonly mode: "neural" | "lexical";
  readonly dims: number;
  isConfigured(): boolean;
  model(): string | null;
  embedText(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

export class EmbeddingNotConfiguredError extends Error {
  status = 503;
  constructor() {
    super("سرویس جاسازی متن (Embedding) پیکربندی نشده است؛ پردازش دانش ممکن نیست.");
  }
}

export class EmbeddingFailedError extends Error {
  status = 502;
  constructor(message = "تولید بردارهای متن با خطا مواجه شد.") {
    super(message);
  }
}
