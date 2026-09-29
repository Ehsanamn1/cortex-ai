import { decryptSecret } from "@/lib/server/secrets";
import { OpenAICompatibleProvider, type CompatibleAuthMode } from "@/lib/providers/llm/openai-compatible";
import { OpenRouterProvider } from "@/lib/providers/llm/openrouter";
import { AnthropicProvider } from "@/lib/providers/llm/anthropic";
import { GeminiProvider } from "@/lib/providers/llm/gemini";
import type { LLMProvider } from "@/lib/providers/llm/types";
import { db } from "@/lib/db";

export type SystemProviderRecord = {
  id: string;
  key: string;
  displayName: string;
  providerName: string;
  protocol: string;
  authMode: string;
  baseUrl: string;
  apiKeyEncrypted: string | null;
  enabled: boolean;
  isTrialProvider: boolean;
};

export function buildSystemProviderForModel(config: SystemProviderRecord, modelId: string): LLMProvider {
  const apiKey = config.apiKeyEncrypted ? decryptSecret(config.apiKeyEncrypted) : undefined;
  const protocol = config.protocol.trim().toLowerCase();

  if (protocol === "anthropic") {
    return new AnthropicProvider({ name: config.providerName, baseUrl: config.baseUrl, apiKey, model: modelId });
  }
  if (protocol === "gemini") {
    return new GeminiProvider({ name: config.providerName, baseUrl: config.baseUrl, apiKey, model: modelId });
  }
  if (protocol === "openrouter") {
    return new OpenRouterProvider({ model: modelId, baseUrl: config.baseUrl, apiKey });
  }
  return new OpenAICompatibleProvider({
    name: config.providerName,
    baseUrl: config.baseUrl,
    apiKey,
    model: modelId,
    authMode: (config.authMode || "bearer") as CompatibleAuthMode,
  });
}

export async function resolveSystemProviderForModel(modelCatalogId: string) {
  const model = await db.modelCatalog.findUnique({ where: { id: modelCatalogId }, include: { systemProvider: true } });
  if (!model) return null;
  if (model.systemProvider?.enabled) return { model, provider: buildSystemProviderForModel(model.systemProvider, model.modelId) };

  const fallback = await db.systemProviderConfig.findFirst({
    where: { providerName: model.provider, enabled: true },
    orderBy: [{ isTrialProvider: "desc" }, { updatedAt: "desc" }],
  });
  if (!fallback) return { model, provider: null };
  return { model, provider: buildSystemProviderForModel(fallback, model.modelId) };
}
