import type {
  AIProvider,
  CompletionRequest,
  CompletionResult,
} from "@/lib/ai/types";
import { AIProviderError } from "@/lib/ai/errors";

export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Provider label for storage/attribution (e.g. "openai"). */
  name?: string;
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * Adapter for any OpenAI Chat Completions-compatible endpoint. The base URL
 * points at the API root (e.g. https://api.openai.com/v1); this appends
 * /chat/completions.
 */
export function createOpenAIProvider(
  cfg: OpenAICompatibleConfig
): AIProvider {
  const endpoint = `${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  return {
    name: cfg.name ?? "openai",
    model: cfg.model,
    isDemo: false,
    async complete(req: CompletionRequest): Promise<CompletionResult> {
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: cfg.model,
            messages: [
              { role: "system", content: req.system },
              { role: "user", content: req.user },
            ],
            temperature: req.temperature ?? 0.2,
            ...(req.json ? { response_format: { type: "json_object" } } : {}),
          }),
          signal: req.signal,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new AIProviderError("The AI request timed out");
        }
        throw new AIProviderError("Could not reach the AI provider");
      }

      if (!res.ok) {
        throw new AIProviderError(
          `AI provider responded with status ${res.status}`
        );
      }

      const data = (await res.json().catch(() => null)) as ChatResponse | null;
      const text = data?.choices?.[0]?.message?.content ?? "";
      if (!text) throw new AIProviderError("The AI provider returned no content");

      return {
        text,
        usage: {
          promptTokens: data?.usage?.prompt_tokens ?? 0,
          completionTokens: data?.usage?.completion_tokens ?? 0,
          totalTokens: data?.usage?.total_tokens ?? 0,
        },
      };
    },
  };
}
