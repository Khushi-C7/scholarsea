/** Token accounting for a completion. */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export const ZERO_USAGE: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

export interface CompletionRequest {
  system: string;
  user: string;
  temperature?: number;
  /** Request JSON-formatted output when the provider supports it. */
  json?: boolean;
  signal?: AbortSignal;
}

export interface CompletionResult {
  text: string;
  usage: TokenUsage;
}

/**
 * A provider adapter. OpenAI-compatible HTTP APIs and the built-in demo
 * provider both implement this; other vendors can be added as new adapters.
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string;
  /** True for the offline, simulated provider used when no key is set. */
  readonly isDemo: boolean;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}
