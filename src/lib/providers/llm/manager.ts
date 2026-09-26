import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/server/secrets";
import type { LLMProvider, LLMProviderType } from "./types";
import { OpenRouterProvider } from "./openrouter";
import { OpenAICompatibleProvider, type CompatibleAuthMode } from "./openai-compatible";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";

export interface ProviderStatus {
  provider: string;
  status: "configured" | "not_configured";
  model: string | null;
  source: "agent" | "workspace" | "environment" | "none";
}

function buildConfiguredProvider(config: {
  providerType?: string | null;
  providerName: string;
  baseUrl: string;
  model: string;
  authMode: string;
  apiKeyEncrypted?: string | null;
}): LLMProvider {
  const key = config.apiKeyEncrypted ? decryptSecret(config.apiKeyEncrypted) : undefined;
  const type = (config.providerType || "openai-compatible") as LLMProviderType;

  if (type === "anthropic") {
    return new AnthropicProvider({
      name: config.providerName,
      baseUrl: config.baseUrl,
      apiKey: key,
      model: config.model,
    });
  }

  if (type === "gemini") {
    return new GeminiProvider({
      name: config.providerName,
      baseUrl: config.baseUrl,
      apiKey: key,
      model: config.model,
    });
  }

  return new OpenAICompatibleProvider({
    name: config.providerName,
    baseUrl: config.baseUrl,
    apiKey: key,
    model: config.model,
    authMode: (config.authMode || "bearer") as CompatibleAuthMode,
  });
}

class ProviderManager {
  private environmentProvider: LLMProvider | null = null;

  private resolveEnvironment(): LLMProvider | null {
    if (this.environmentProvider) return this.environmentProvider;
    const explicit = process.env.LLM_PROVIDER?.trim().toLowerCase();
    if (explicit === "openrouter" || (!explicit && process.env.OPENROUTER_API_KEY)) {
      const provider = new OpenRouterProvider();
      if (provider.isConfigured()) {
        this.environmentProvider = provider;
        return provider;
      }
    }
    if (explicit && explicit !== "auto" && explicit !== "openrouter") return null;
    return null;
  }

  private statusFor(provider: LLMProvider | null, source: ProviderStatus["source"]): ProviderStatus {
    return {
      provider: provider?.name ?? "none",
      status: provider ? "configured" : "not_configured",
      model: provider?.model() ?? null,
      source: provider ? source : "none",
    };
  }

  async resolveForAgent(agentId: string, workspaceId?: string): Promise<{ provider: LLMProvider | null; status: ProviderStatus }> {
    const agentConfig = await db.agentProviderConfig.findUnique({ where: { agentId } });

    if (agentConfig) {
      if (!agentConfig.enabled) {
        return {
          provider: null,
          status: {
            provider: agentConfig.providerName,
            status: "not_configured",
            model: agentConfig.model || null,
            source: "none",
          },
        };
      }

      const provider = buildConfiguredProvider(agentConfig);
      if (provider.isConfigured()) {
        return { provider, status: this.statusFor(provider, "agent") };
      }
      return {
        provider: null,
        status: {
          provider: agentConfig.providerName,
          status: "not_configured",
          model: agentConfig.model || null,
          source: "none",
        },
      };
    }

    // Backward compatibility for workspaces that used the old Settings flow.
    // Only agents without an agent-level config use this legacy fallback.
    if (workspaceId) {
      const legacy = await db.providerConfig.findUnique({ where: { workspaceId } });
      if (legacy?.enabled) {
        const provider = buildConfiguredProvider(legacy);
        if (provider.isConfigured()) {
          return { provider, status: this.statusFor(provider, "workspace") };
        }
      }
    }

    const envProvider = this.resolveEnvironment();
    if (envProvider) {
      return { provider: envProvider, status: this.statusFor(envProvider, "environment") };
    }

    return { provider: null, status: this.statusFor(null, "none") };
  }

  async resolveForWorkspace(workspaceId?: string): Promise<{ provider: LLMProvider | null; status: ProviderStatus }> {
    if (workspaceId) {
      const config = await db.providerConfig.findUnique({ where: { workspaceId } });
      if (config?.enabled) {
        const provider = buildConfiguredProvider(config);
        if (provider.isConfigured()) {
          return { provider, status: this.statusFor(provider, "workspace") };
        }
        return {
          provider: null,
          status: {
            provider: config.providerName,
            status: "not_configured",
            model: config.model || null,
            source: "none",
          },
        };
      }
    }

    const envProvider = this.resolveEnvironment();
    if (envProvider) {
      return { provider: envProvider, status: this.statusFor(envProvider, "environment") };
    }

    return { provider: null, status: this.statusFor(null, "none") };
  }

  resolve(): LLMProvider | null {
    return this.resolveEnvironment();
  }

  async statusForAgent(agentId: string): Promise<ProviderStatus> {
    const config = await db.agentProviderConfig.findUnique({ where: { agentId } });
    if (!config) {
      return {
        provider: "none",
        status: "not_configured",
        model: null,
        source: "none",
      };
    }
    if (!config.enabled) {
      return {
        provider: config.providerName,
        status: "not_configured",
        model: config.model || null,
        source: "none",
      };
    }

    const provider = buildConfiguredProvider(config);
    return provider.isConfigured()
      ? this.statusFor(provider, "agent")
      : {
          provider: config.providerName,
          status: "not_configured",
          model: config.model || null,
          source: "none",
        };
  }

  async statusForWorkspace(workspaceId?: string): Promise<ProviderStatus> {
    return (await this.resolveForWorkspace(workspaceId)).status;
  }

  status(): ProviderStatus {
    const p = this.resolve();
    return this.statusFor(p, p ? "environment" : "none");
  }
}

export const llmManager = new ProviderManager();
