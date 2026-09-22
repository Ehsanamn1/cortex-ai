import type { EmbeddingProvider } from "./types";
import { OpenAIEmbeddingProvider } from "./openai";
import { LocalLexicalEmbeddingProvider } from "./lexical";

export interface EmbeddingStatus {
  provider: string;
  status: "configured" | "not_configured";
  model: string | null;
  mode: "neural" | "lexical" | null;
}

/**
 * Resolves the active embedding provider:
 * 1. EMBEDDINGS_PROVIDER env (openai | local-lexical)
 * 2. OPENAI_API_KEY present → openai (neural)
 * 3. local-lexical (real local engine — always configured)
 */
class EmbeddingManager {
  private providers = new Map<string, EmbeddingProvider>();
  private resolved: EmbeddingProvider | null = null;

  register(provider: EmbeddingProvider) {
    this.providers.set(provider.name, provider);
    this.resolved = null;
  }

  resolve(): EmbeddingProvider | null {
    if (this.resolved) return this.resolved;
    const explicit = process.env.EMBEDDINGS_PROVIDER?.trim().toLowerCase();
    if (explicit && explicit !== "auto") {
      const p = this.providers.get(explicit);
      if (p?.isConfigured()) {
        this.resolved = p;
        return p;
      }
      return null;
    }
    const openai = this.providers.get("openai");
    if (openai?.isConfigured()) {
      this.resolved = openai;
      return openai;
    }
    const local = this.providers.get("local-lexical");
    if (local?.isConfigured()) {
      this.resolved = local;
      return local;
    }
    return null;
  }

  status(): EmbeddingStatus {
    const p = this.resolve();
    return {
      provider: p ? p.name : process.env.EMBEDDINGS_PROVIDER?.trim() || "none",
      status: p ? "configured" : "not_configured",
      model: p ? p.model() : null,
      mode: p ? p.mode : null,
    };
  }
}

export const embeddingManager = new EmbeddingManager();
embeddingManager.register(new OpenAIEmbeddingProvider());
embeddingManager.register(new LocalLexicalEmbeddingProvider());
