import {
  EmbeddingFailedError,
  type EmbeddingProvider,
} from "./types";

/**
 * Real neural embeddings through any OpenAI-compatible /embeddings endpoint.
 * Active when OPENAI_API_KEY (+ EMBEDDINGS_MODEL) is configured.
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name: string;
  readonly mode = "neural" as const;

  constructor(private readonly baseUrl?: string) {
    this.name = process.env.EMBEDDINGS_PROVIDER?.trim().toLowerCase() || "openai";
  }

  private apiKey(): string | undefined {
    const key = process.env.OPENAI_API_KEY?.trim();
    return key && key.length > 0 ? key : undefined;
  }

  private endpoint(): string {
    const base = (this.baseUrl ?? process.env.EMBEDDINGS_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    return `${base}/embeddings`;
  }

  get dims(): number {
    // Only meaningful after first embed; callers use provider-agnostic storage.
    return Number(process.env.EMBEDDINGS_DIMS ?? 0);
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  model(): string | null {
    return process.env.EMBEDDINGS_MODEL?.trim() || null;
  }

  async embedText(text: string): Promise<number[]> {
    const [vec] = await this.embedDocuments([text]);
    return vec;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const key = this.apiKey();
    const model = this.model();
    if (!key || !model) throw new EmbeddingFailedError("سرویس جاسازی متن پیکربندی نشده است.");
    try {
      const res = await fetch(this.endpoint(), {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: texts }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        console.error("[cortex][embeddings] HTTP", res.status, (await res.text()).slice(0, 300));
        throw new Error(`embeddings http ${res.status}`);
      }
      const data = (await res.json()) as { data?: Array<{ embedding?: number[]; index?: number }> };
      const vectors = data.data
        ?.slice()
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((d) => d.embedding);
      if (!vectors || vectors.length !== texts.length || vectors.some((v) => !Array.isArray(v))) {
        throw new Error("embeddings shape mismatch");
      }
      return vectors as number[][];
    } catch (e) {
      if (e instanceof EmbeddingFailedError) throw e;
      console.error("[cortex][embeddings] failed:", e instanceof Error ? e.message : e);
      throw new EmbeddingFailedError();
    }
  }
}
