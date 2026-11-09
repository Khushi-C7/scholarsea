/**
 * Supported AI providers and models, with rough price estimates used only to
 * label an *estimated* cost in Settings. Prices are USD per 1,000 tokens and
 * are approximate list prices that change over time — they are never presented
 * as an actual bill. This module is client-safe (no secrets).
 */

export interface ModelInfo {
  id: string;
  label: string;
  /** Estimated USD per 1K input tokens. */
  inputPer1k: number;
  /** Estimated USD per 1K output tokens. */
  outputPer1k: number;
}

export interface ProviderInfo {
  id: string;
  label: string;
  /** API root the OpenAI-compatible adapter should target. */
  baseUrl: string;
  /** Whether this provider needs a user-supplied API key. */
  requiresKey: boolean;
  models: ModelInfo[];
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    requiresKey: true,
    models: [
      { id: "gpt-4o", label: "GPT-4o", inputPer1k: 0.005, outputPer1k: 0.015 },
      { id: "gpt-4o-mini", label: "GPT-4o mini", inputPer1k: 0.00015, outputPer1k: 0.0006 },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    requiresKey: true,
    models: [
      { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", inputPer1k: 0.003, outputPer1k: 0.015 },
      { id: "claude-3-5-haiku", label: "Claude 3.5 Haiku", inputPer1k: 0.0008, outputPer1k: 0.004 },
    ],
  },
  {
    id: "openai-compatible",
    label: "OpenAI-compatible (custom)",
    baseUrl: "",
    requiresKey: true,
    models: [
      { id: "custom", label: "Custom model", inputPer1k: 0, outputPer1k: 0 },
    ],
  },
  {
    id: "demo",
    label: "Demo (offline, no key)",
    baseUrl: "",
    requiresKey: false,
    models: [{ id: "demo", label: "Simulated", inputPer1k: 0, outputPer1k: 0 }],
  },
];

export function findProvider(id: string | null | undefined): ProviderInfo | null {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

export function findModel(
  providerId: string | null | undefined,
  modelId: string | null | undefined
): ModelInfo | null {
  const p = findProvider(providerId);
  if (!p) return null;
  return p.models.find((m) => m.id === modelId) ?? null;
}

/**
 * Estimate USD cost for a token split against a model's list prices. When the
 * per-token split isn't known, both halves use the same total — callers must
 * label the result an estimate. Returns null when the model has no price.
 */
export function estimateCost(
  model: ModelInfo | null,
  promptTokens: number,
  completionTokens: number
): number | null {
  if (!model) return null;
  if (model.inputPer1k === 0 && model.outputPer1k === 0) return null;
  return (
    (promptTokens / 1000) * model.inputPer1k +
    (completionTokens / 1000) * model.outputPer1k
  );
}
