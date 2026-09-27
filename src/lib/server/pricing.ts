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

  // Current 2026 model catalog. Rates are standard public API rates;
  // providers may add tool, search, fast-mode, regional, or long-context fees.
  if (m.includes("gpt-6-astra")) return { inputUsdPer1M: 10, outputUsdPer1M: 50, known: true, label: "OpenAI GPT-6 Astra" };
  if (m.includes("gpt-6-sol")) return { inputUsdPer1M: 2, outputUsdPer1M: 10, known: true, label: "OpenAI GPT-6 Sol" };
  if (m.includes("gpt-6-luna")) return { inputUsdPer1M: 0.10, outputUsdPer1M: 0.50, known: true, label: "OpenAI GPT-6 Luna" };
  if (m.includes("gpt-5.6-luna")) return { inputUsdPer1M: 0.20, outputUsdPer1M: 1.20, known: true, label: "OpenAI GPT-5.6 Luna" };
  if (m.includes("gpt-5.6-terra")) return { inputUsdPer1M: 1, outputUsdPer1M: 6, known: true, label: "OpenAI GPT-5.6 Terra" };
  if (m.includes("gpt-5.6-sol")) return { inputUsdPer1M: 2, outputUsdPer1M: 10, known: true, label: "OpenAI GPT-5.6 Sol" };

  if (m.includes("glm-5.3-flash")) return { inputUsdPer1M: 0.15, outputUsdPer1M: 0.50, known: true, label: "Z.AI GLM-5.3 Flash" };
  if (m.includes("glm-5.3")) return { inputUsdPer1M: 1.40, outputUsdPer1M: 4.40, known: true, label: "Z.AI GLM-5.3" };

  if (m.includes("deepseek-v4.1-flash") || m === "deepseek-flash") {
    return { inputUsdPer1M: 0.15, outputUsdPer1M: 0.60, known: true, label: "DeepSeek V4.1 Flash" };
  }
  if (m.includes("deepseek-v4-pro") || m === "deepseek-v4") {
    return { inputUsdPer1M: 0.66, outputUsdPer1M: 1.98, known: true, label: "DeepSeek V4 Pro (off-peak base)" };
  }
  if (m.includes("claude-opus-5")) return { inputUsdPer1M: 5, outputUsdPer1M: 25, known: true, label: "Anthropic Claude Opus 5" };
  if (m.includes("claude-opus-4-8") || m.includes("opus-4.8")) return { inputUsdPer1M: 5, outputUsdPer1M: 25, known: true, label: "Anthropic Claude Opus 4.8" };
  if (m.includes("gemini-3.8-flash")) return { inputUsdPer1M: 0.75, outputUsdPer1M: 3.75, known: true, label: "Google Gemini 3.8 Flash" };

  if (m.includes("gpt-5-mini") || m.includes("gpt-5.4-mini")) {
    return m.includes("gpt-5.4-mini")
      ? { inputUsdPer1M: 0.75, outputUsdPer1M: 4.5, known: true, label: "OpenAI GPT-5.4 mini" }
      : { inputUsdPer1M: 0.25, outputUsdPer1M: 2, known: true, label: "OpenAI GPT-5 mini" };
  }
  if (m === "gpt-5.4") {
    return { inputUsdPer1M: 2.5, outputUsdPer1M: 15, known: true, label: "OpenAI GPT-5.4" };
  }
  if (m === "gpt-5.4-nano") {
    return { inputUsdPer1M: 0.20, outputUsdPer1M: 1.25, known: true, label: "OpenAI GPT-5.4 nano" };
  }
  if (m === "gpt-5") {
    return { inputUsdPer1M: 1.25, outputUsdPer1M: 10, known: true, label: "OpenAI GPT-5" };
  }
  if (m === "gpt-5-nano") {
    return { inputUsdPer1M: 0.05, outputUsdPer1M: 0.40, known: true, label: "OpenAI GPT-5 nano" };
  }

  if (m.includes("claude-sonnet-5") || m.includes("sonnet-5")) {
    return { inputUsdPer1M: 2, outputUsdPer1M: 10, known: true, label: "Anthropic Claude Sonnet 5" };
  }
  if (m.includes("claude-sonnet-4-6") || m.includes("sonnet-4.6")) {
    return { inputUsdPer1M: 3, outputUsdPer1M: 15, known: true, label: "Anthropic Claude Sonnet 4.6" };
  }
  if (m.includes("claude-haiku-4-5") || m.includes("haiku-4.5")) {
    return { inputUsdPer1M: 1, outputUsdPer1M: 5, known: true, label: "Anthropic Claude Haiku 4.5" };
  }

  if (m.includes("gemini-3.7-flash") || m.includes("gemini-3.6-flash")) {
    return { inputUsdPer1M: 0.75, outputUsdPer1M: 3.75, known: true, label: "Google Gemini Flash" };
  }
  if (m.includes("gemini-2.5-flash-lite")) {
    return { inputUsdPer1M: 0.10, outputUsdPer1M: 0.40, known: true, label: "Google Gemini 2.5 Flash-Lite" };
  }
  if (m.includes("gemini-2.5-flash")) {
    return { inputUsdPer1M: 0.30, outputUsdPer1M: 2.50, known: true, label: "Google Gemini 2.5 Flash" };
  }

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
