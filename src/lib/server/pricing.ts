export const PRICING_VERIFIED_AT = "2026-09-28";
export const PRICING_MODE = "official-provider-snapshot";

export interface ModelRate {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  known: boolean;
  label: string;
}

function envRate(name: string): number | null {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function getModelRate(provider: string, model: string): ModelRate {
  const p = provider.toLowerCase();
  const m = model.toLowerCase();
  const routedProvider = p === "openrouter" ? m.split("/")[0] : p;

  // Verified public standard API snapshots as of 2026-09-28.
  if (routedProvider.includes("openai") && m.includes("gpt-6-astra")) return { inputUsdPer1M: 10, outputUsdPer1M: 50, known: true, label: "OpenAI GPT-6 Astra" };
  if (routedProvider.includes("openai") && m.includes("gpt-6-sol")) return { inputUsdPer1M: 2, outputUsdPer1M: 10, known: true, label: "OpenAI GPT-6 Sol" };
  if (routedProvider.includes("openai") && m.includes("gpt-6-luna")) return { inputUsdPer1M: 0.1, outputUsdPer1M: 0.5, known: true, label: "OpenAI GPT-6 Luna" };
  if (routedProvider.includes("openai") && m.includes("gpt-5.6-cyber")) return { inputUsdPer1M: 12.5, outputUsdPer1M: 75, known: true, label: "OpenAI GPT-5.6 Cyber" };
  if (routedProvider.includes("openai") && m.includes("gpt-5.6-terra")) return { inputUsdPer1M: 2, outputUsdPer1M: 12, known: true, label: "OpenAI GPT-5.6 Terra" };
  if (routedProvider.includes("openai") && m.includes("gpt-5.6-sol")) return { inputUsdPer1M: 4, outputUsdPer1M: 20, known: true, label: "OpenAI GPT-5.6 Sol" };
  if (routedProvider.includes("openai") && m.includes("gpt-5.6-luna")) return { inputUsdPer1M: 0.2, outputUsdPer1M: 1.2, known: true, label: "OpenAI GPT-5.6 Luna" };

  if ((routedProvider.includes("openai")) && m.includes("gpt-5.5-pro")) return { inputUsdPer1M: 30, outputUsdPer1M: 180, known: true, label: "OpenAI GPT-5.5 Pro" };
  if ((routedProvider.includes("openai")) && m.includes("gpt-5.5")) return { inputUsdPer1M: 5, outputUsdPer1M: 30, known: true, label: "OpenAI GPT-5.5" };
  if ((routedProvider.includes("openai")) && m.includes("gpt-5.4-pro")) return { inputUsdPer1M: 30, outputUsdPer1M: 180, known: true, label: "OpenAI GPT-5.4 Pro" };
  if ((routedProvider.includes("openai")) && m.includes("gpt-5.4")) return { inputUsdPer1M: 2.5, outputUsdPer1M: 15, known: true, label: "OpenAI GPT-5.4" };
  if ((routedProvider.includes("openai")) && m.includes("gpt-5.4-mini")) return { inputUsdPer1M: 0.75, outputUsdPer1M: 4.5, known: true, label: "OpenAI GPT-5.4 mini" };

  if ((routedProvider.includes("anthropic")) && (m.includes("claude-opus-5.5") || m.includes("claude-opus-5-5"))) return { inputUsdPer1M: 4, outputUsdPer1M: 20, known: true, label: "Anthropic Claude Opus 5.5" };
  if ((routedProvider.includes("anthropic")) && m.includes("claude-opus-5")) return { inputUsdPer1M: 5, outputUsdPer1M: 25, known: true, label: "Anthropic Claude Opus 5" };
  if ((routedProvider.includes("anthropic")) && m.includes("claude-sonnet-5")) return { inputUsdPer1M: 2, outputUsdPer1M: 10, known: true, label: "Anthropic Claude Sonnet 5" };
  if ((routedProvider.includes("anthropic")) && (m.includes("claude-sonnet-4.6") || m.includes("claude-sonnet-4-6"))) return { inputUsdPer1M: 3, outputUsdPer1M: 15, known: true, label: "Anthropic Claude Sonnet 4.6" };
  if ((routedProvider.includes("anthropic")) && (m.includes("claude-haiku-4.5") || m.includes("claude-haiku-4-5"))) return { inputUsdPer1M: 1, outputUsdPer1M: 5, known: true, label: "Anthropic Claude Haiku 4.5" };

  if ((routedProvider.includes("google")) && m.includes("gemini-3.1-pro-preview")) return { inputUsdPer1M: 2, outputUsdPer1M: 12, known: true, label: "Google Gemini 3.1 Pro Preview (≤200K input)" };
  if ((routedProvider.includes("google")) && (m.includes("gemini-3.8-flash") || m.includes("gemini-3.7-flash"))) return { inputUsdPer1M: 0.75, outputUsdPer1M: 3.75, known: true, label: "Google Gemini Flash" };
  if ((routedProvider.includes("google")) && m.includes("gemini-3.1-flash-lite")) return { inputUsdPer1M: 0.25, outputUsdPer1M: 1.5, known: true, label: "Google Gemini 3.1 Flash-Lite" };
  if ((routedProvider.includes("google")) && m.includes("gemini-3-flash-preview")) return { inputUsdPer1M: 0.5, outputUsdPer1M: 3, known: true, label: "Google Gemini 3 Flash Preview" };
  if ((routedProvider.includes("google")) && m.includes("gemini-2.5-flash-lite")) return { inputUsdPer1M: 0.1, outputUsdPer1M: 0.4, known: true, label: "Google Gemini 2.5 Flash-Lite" };
  if ((routedProvider.includes("google")) && m.includes("gemini-2.5-flash")) return { inputUsdPer1M: 0.3, outputUsdPer1M: 2.5, known: true, label: "Google Gemini 2.5 Flash" };

  if (routedProvider.includes("deepseek") && m.includes("deepseek-v4.1-flash")) {
    return { inputUsdPer1M: 0.13, outputUsdPer1M: 0.52, known: true, label: "DeepSeek V4.1 Flash" };
  }
  if ((routedProvider.includes("deepseek")) && (m.includes("deepseek-flash") || m.includes("deepseek-v4-flash"))) {
    return { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6, known: true, label: "DeepSeek Flash" };
  }
  if ((routedProvider.includes("deepseek")) && (m.includes("deepseek-v4-pro") || m === "deepseek-v4")) {
    return { inputUsdPer1M: 0.66, outputUsdPer1M: 1.98, known: true, label: "DeepSeek V4 Pro (off-peak base)" };
  }

  if (routedProvider.includes("qwen") && (m.includes("qwen3.5-flash") || m.includes("qwen3.7-flash"))) return { inputUsdPer1M: 0.03, outputUsdPer1M: 0.13, known: true, label: "Qwen3.5 Flash" };
  if (routedProvider.includes("qwen") && m.includes("qwen3.8-max")) return { inputUsdPer1M: 2, outputUsdPer1M: 6, known: true, label: "Qwen3.8 Max" };

  const input = envRate("CORTEX_INPUT_USD_PER_1M");
  const output = envRate("CORTEX_OUTPUT_USD_PER_1M");
  if (input !== null && output !== null) {
    return { inputUsdPer1M: input, outputUsdPer1M: output, known: false, label: "Custom Cortex rate" };
  }
  return { inputUsdPer1M: 0, outputUsdPer1M: 0, known: false, label: "Unknown model rate" };
}

export function estimateLlmCostMicros(inputTokens: number, outputTokens: number, provider: string, model: string): number {
  const rate = getModelRate(provider, model);
  const input = Math.max(0, Number(inputTokens) || 0) * rate.inputUsdPer1M / 1_000_000;
  const output = Math.max(0, Number(outputTokens) || 0) * rate.outputUsdPer1M / 1_000_000;
  return Math.max(0, Math.round((input + output) * 1_000_000));
}

export function usdFromMicros(micros: number): number {
  return Math.max(0, Number(micros) || 0) / 1_000_000;
}


export interface KnownModelCatalogEntry {
  provider: string;
  modelId: string;
  displayName: string;
  qualityTier: "economy" | "balanced" | "premium" | "deep";
  speedTier: "fast" | "balanced" | "deep";
  contextWindow?: number;
  vision?: boolean;
  tools?: boolean;
  structuredOutput?: boolean;
  reasoning?: boolean;
  commercialAvailable?: boolean;
}

/**
 * Single source of truth for the currently recognized model IDs. Commercial
 * tables can be seeded from this registry instead of duplicating vendor prices
 * across UI components.
 */
export function getKnownModelCatalog(): Array<KnownModelCatalogEntry & Pick<ModelRate, "inputUsdPer1M" | "outputUsdPer1M" | "known">> {
  const seeds: KnownModelCatalogEntry[] = [
    { provider: "OpenAI", modelId: "gpt-6-astra", displayName: "GPT-6 Astra", qualityTier: "deep", speedTier: "deep", reasoning: true, tools: true, structuredOutput: true, contextWindow: 1050000 },
    { provider: "OpenAI", modelId: "gpt-6-sol", displayName: "GPT-6 Sol", qualityTier: "premium", speedTier: "balanced", reasoning: true, tools: true, structuredOutput: true, contextWindow: 1050000 },
    { provider: "OpenAI", modelId: "gpt-6-luna", displayName: "GPT-6 Luna", qualityTier: "economy", speedTier: "fast", reasoning: true, tools: true, structuredOutput: true, contextWindow: 1050000 },
    { provider: "OpenAI", modelId: "gpt-5.6-terra", displayName: "GPT-5.6 Terra", qualityTier: "premium", speedTier: "balanced", reasoning: true, tools: true, structuredOutput: true },
    { provider: "OpenAI", modelId: "gpt-5.6-sol", displayName: "GPT-5.6 Sol", qualityTier: "premium", speedTier: "balanced", reasoning: true, tools: true, structuredOutput: true },
    { provider: "OpenAI", modelId: "gpt-5.6-luna", displayName: "GPT-5.6 Luna", qualityTier: "balanced", speedTier: "fast", reasoning: true, tools: true, structuredOutput: true },
    { provider: "OpenAI", modelId: "gpt-5.6-cyber", displayName: "GPT-5.6 Cyber", qualityTier: "deep", speedTier: "deep", reasoning: true, tools: true, structuredOutput: true },
    { provider: "Google", modelId: "gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro Preview", qualityTier: "deep", speedTier: "balanced", reasoning: true, tools: true, vision: true, structuredOutput: true, contextWindow: 1000000 },

    { provider: "OpenAI", modelId: "gpt-5.5", displayName: "GPT-5.5", qualityTier: "deep", speedTier: "balanced", reasoning: true, tools: true, structuredOutput: true, contextWindow: 1050000 },
    { provider: "OpenAI", modelId: "gpt-5.5-pro", displayName: "GPT-5.5 Pro", qualityTier: "deep", speedTier: "deep", reasoning: true, tools: true, structuredOutput: true, contextWindow: 1050000 },
    { provider: "OpenAI", modelId: "gpt-5.4", displayName: "GPT-5.4", qualityTier: "premium", speedTier: "balanced", reasoning: true, tools: true, structuredOutput: true, contextWindow: 1050000 },
    { provider: "OpenAI", modelId: "gpt-5.4-pro", displayName: "GPT-5.4 Pro", qualityTier: "deep", speedTier: "deep", reasoning: true, tools: true, structuredOutput: true, contextWindow: 1050000 },
    { provider: "OpenAI", modelId: "gpt-5.4-mini", displayName: "GPT-5.4 mini", qualityTier: "balanced", speedTier: "fast", tools: true, structuredOutput: true },

    { provider: "Anthropic", modelId: "claude-opus-5-5", displayName: "Claude Opus 5.5", qualityTier: "deep", speedTier: "deep", reasoning: true, tools: true },
    { provider: "Anthropic", modelId: "claude-opus-5", displayName: "Claude Opus 5", qualityTier: "deep", speedTier: "deep", reasoning: true, tools: true },
    { provider: "Anthropic", modelId: "claude-sonnet-5", displayName: "Claude Sonnet 5", qualityTier: "premium", speedTier: "balanced", reasoning: true, tools: true },
    { provider: "Anthropic", modelId: "claude-sonnet-4.6", displayName: "Claude Sonnet 4.6", qualityTier: "premium", speedTier: "balanced", reasoning: true, tools: true },
    { provider: "Anthropic", modelId: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", qualityTier: "balanced", speedTier: "fast", tools: true },

    { provider: "Google", modelId: "gemini-3.7-flash", displayName: "Gemini 3.7 Flash", qualityTier: "balanced", speedTier: "fast", tools: true, vision: true },
    { provider: "Google", modelId: "gemini-3.1-flash-lite", displayName: "Gemini 3.1 Flash-Lite", qualityTier: "economy", speedTier: "fast", tools: true, vision: true },
    { provider: "Google", modelId: "gemini-3-flash-preview", displayName: "Gemini 3 Flash Preview", qualityTier: "balanced", speedTier: "fast", tools: true, vision: true },
    { provider: "Google", modelId: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", qualityTier: "balanced", speedTier: "fast", tools: true, vision: true },
    { provider: "Google", modelId: "gemini-2.5-flash-lite", displayName: "Gemini 2.5 Flash-Lite", qualityTier: "economy", speedTier: "fast", tools: true, vision: true },

    { provider: "DeepSeek", modelId: "deepseek-v4-pro", displayName: "DeepSeek V4 Pro", qualityTier: "premium", speedTier: "balanced", reasoning: true, tools: true },
    { provider: "DeepSeek", modelId: "deepseek-flash", displayName: "DeepSeek Flash", qualityTier: "economy", speedTier: "fast", reasoning: true, tools: true },
  ];
  return seeds.map((seed) => ({ ...seed, ...getModelRate(seed.provider, seed.modelId) }));
}
