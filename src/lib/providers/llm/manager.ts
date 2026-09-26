import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/server/secrets";
import type { GenerateOptions, LLMProvider } from "./types";
import { ProviderUnavailableError, classifyProviderFailure } from "./types";
import { OpenRouterProvider } from "./openrouter";
import { OpenAICompatibleProvider, type CompatibleAuthMode } from "./openai-compatible";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";

type CachedConfig = { config: { providerName:string; baseUrl:string; model:string; protocol?:string; authMode:string; apiKeyEncrypted?:string|null; enabled:boolean }; expiresAt:number };

const CONFIG_TTL_MS = 15_000;
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 20_000;

const configCache = new Map<string, CachedConfig>();
const circuitState = new Map<string, { failures:number; openedUntil:number; lastCode?:string }>();

class ResilientProvider implements LLMProvider {
  readonly name: string;
  constructor(private readonly inner: LLMProvider, private readonly agentId: string, private readonly workspaceId?: string) { this.name = inner.name; }
  isConfigured(){ return this.inner.isConfigured(); }
  model(){ return this.inner.model(); }
  async generateResponse(options: GenerateOptions) {
    const key = this.agentId + ":" + this.name;
    const state = circuitState.get(key);
    if (state && state.openedUntil > Date.now()) {
      throw new ProviderUnavailableError({ code:"provider_circuit_open", provider:this.name, retryable:true, retryAfterMs:state.openedUntil-Date.now() });
    }
    const maxAttempts = this.inner instanceof OpenAICompatibleProvider ? 0 : 2;
    const started = Date.now();
    let last: unknown;
    for (let attempt=0; attempt<=maxAttempts; attempt++) {
      try {
        const result = await this.inner.generateResponse(options);
        circuitState.set(key,{failures:0,openedUntil:0});
        void db.agentProviderHealth.upsert({
          where:{agentId:this.agentId},
          update:{workspaceId:this.workspaceId ?? "", state:"healthy", consecutiveFailures:0, openedUntil:null, lastCode:null, lastStatus:null, lastLatencyMs:Date.now()-started, lastError:null, lastSuccessAt:new Date()},
          create:{agentId:this.agentId, workspaceId:this.workspaceId ?? "", state:"healthy", consecutiveFailures:0, lastLatencyMs:Date.now()-started, lastSuccessAt:new Date()}
        }).catch(()=>undefined);
        return result;
      } catch(error) {
        last = error;
        const classified = classifyProviderFailure(error,this.name);
        const existing = circuitState.get(key) ?? {failures:0,openedUntil:0};
        const failures = existing.failures + 1;
        const shouldOpen = classified.retryable && failures >= CIRCUIT_THRESHOLD;
        const openedUntil = shouldOpen ? Date.now()+CIRCUIT_COOLDOWN_MS : 0;
        circuitState.set(key,{failures,openedUntil,lastCode:classified.code});
        void db.agentProviderHealth.upsert({
          where:{agentId:this.agentId},
          update:{workspaceId:this.workspaceId ?? "", state:shouldOpen?"open":"degraded", consecutiveFailures:failures, openedUntil:openedUntil?new Date(openedUntil):null, lastCode:classified.code, lastStatus:classified.rawStatus ?? null, lastLatencyMs:Date.now()-started, lastError:(classified.causeMessage ?? classified.message).slice(0,500), lastErrorAt:new Date()},
          create:{agentId:this.agentId, workspaceId:this.workspaceId ?? "", state:shouldOpen?"open":"degraded", consecutiveFailures:failures, openedUntil:openedUntil?new Date(openedUntil):null, lastCode:classified.code, lastStatus:classified.rawStatus ?? null, lastLatencyMs:Date.now()-started, lastError:(classified.causeMessage ?? classified.message).slice(0,500), lastErrorAt:new Date()}
        }).catch(()=>undefined);
        if (attempt < maxAttempts && classified.retryable) {
          const retryMs = Math.min(1200, classified.retryAfterMs ?? 200 * 2**attempt);
          await new Promise(resolve=>setTimeout(resolve,retryMs));
          continue;
        }
        throw classified;
      }
    }
    throw classifyProviderFailure(last,this.name);
  }
  healthCheck(){ return this.inner.healthCheck(); }
}

export interface ProviderStatus {
  provider: string;
  status: "configured" | "not_configured";
  model: string | null;
  source: "agent" | "workspace" | "environment" | "none";
}

function buildConfiguredProvider(config: {
  providerName: string;
  baseUrl: string;
  model: string;
  protocol?: string;
  authMode: string;
  apiKeyEncrypted?: string | null;
}): LLMProvider {
  const key = config.apiKeyEncrypted ? decryptSecret(config.apiKeyEncrypted) : undefined;
  const protocol = (config.protocol || "openai-compatible").toLowerCase();

  if (protocol === "anthropic") {
    return new AnthropicProvider({
      name: config.providerName,
      baseUrl: config.baseUrl,
      apiKey: key,
      model: config.model,
    });
  }

  if (protocol === "gemini") {
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
    const cached = configCache.get(agentId);
    const agentConfig = cached && cached.expiresAt > Date.now()
      ? cached.config
      : await db.agentProviderConfig.findUnique({ where: { agentId } });
    if (agentConfig) configCache.set(agentId, { config: agentConfig, expiresAt: Date.now()+CONFIG_TTL_MS });

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
        return { provider: new ResilientProvider(provider, agentId, workspaceId), status: this.statusFor(provider, "agent") };
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
          return { provider: new ResilientProvider(provider, agentId, workspaceId), status: this.statusFor(provider, "workspace") };
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
    const cached = configCache.get(agentId);
    const config = cached && cached.expiresAt > Date.now() ? cached.config : await db.agentProviderConfig.findUnique({ where: { agentId } });
    if (config) configCache.set(agentId, { config, expiresAt: Date.now()+CONFIG_TTL_MS });
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
