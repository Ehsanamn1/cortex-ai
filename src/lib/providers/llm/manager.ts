import { db } from '@/lib/db';
import { decryptSecret } from '@/lib/server/secrets';
import type { LLMProvider } from './types';
import { OpenRouterProvider } from './openrouter';
import { OpenAICompatibleProvider, type CompatibleAuthMode } from './openai-compatible';

export interface ProviderStatus {
  provider: string;
  status: 'configured' | 'not_configured';
  model: string | null;
  source: 'workspace' | 'environment' | 'none';
}

class ProviderManager {
  private environmentProvider: LLMProvider | null = null;

  private resolveEnvironment(): LLMProvider | null {
    if (this.environmentProvider) return this.environmentProvider;
    const explicit = process.env.LLM_PROVIDER?.trim().toLowerCase();
    if (explicit === 'openrouter' || (!explicit && process.env.OPENROUTER_API_KEY)) {
      const provider = new OpenRouterProvider();
      if (provider.isConfigured()) { this.environmentProvider = provider; return provider; }
    }
    if (explicit && explicit !== 'auto' && explicit !== 'openrouter') return null;
    return null;
  }

  async resolveForWorkspace(workspaceId?: string): Promise<{ provider: LLMProvider | null; status: ProviderStatus }> {
    if (workspaceId) {
      const config = await db.providerConfig.findUnique({ where: { workspaceId } });
      if (config?.enabled) {
        const key = config.apiKeyEncrypted ? decryptSecret(config.apiKeyEncrypted) : undefined;
        const provider = new OpenAICompatibleProvider({
          name: config.providerName,
          baseUrl: config.baseUrl,
          apiKey: key,
          model: config.model,
          authMode: (config.authMode || 'bearer') as CompatibleAuthMode,
        });
        return {
          provider: provider.isConfigured() ? provider : null,
          status: { provider: config.providerName, status: provider.isConfigured() ? 'configured' : 'not_configured', model: config.model || null, source: 'workspace' },
        };
      }
    }
    const envProvider = this.resolveEnvironment();
    if (!envProvider) return { provider: null, status: { provider: process.env.LLM_PROVIDER?.trim() || 'none', status: 'not_configured', model: process.env.LLM_MODEL?.trim() || null, source: 'none' } };
    return { provider: envProvider, status: { provider: envProvider.name, status: 'configured', model: envProvider.model(), source: 'environment' } };
  }

  resolve(): LLMProvider | null {
    const provider = this.resolveEnvironment();
    return provider;
  }

  async statusForWorkspace(workspaceId?: string): Promise<ProviderStatus> {
    return (await this.resolveForWorkspace(workspaceId)).status;
  }

  status(): ProviderStatus {
    const p = this.resolve();
    return { provider: p?.name ?? (process.env.LLM_PROVIDER?.trim() || 'none'), status: p ? 'configured' : 'not_configured', model: p?.model() ?? (process.env.LLM_MODEL?.trim() || null), source: p ? 'environment' : 'none' };
  }
}

export const llmManager = new ProviderManager();
