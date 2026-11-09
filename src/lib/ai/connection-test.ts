import "server-only";

import { findProvider } from "@/lib/ai/catalog";
import { createOpenAIProvider } from "@/lib/ai/openai";

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number | null;
  message: string;
}

/**
 * Make a real, minimal completion call to verify a provider + key actually
 * work. Honest by construction: it reports the true outcome, including when
 * the provider can't be reached (e.g. network restrictions) — it never claims
 * success without a successful round-trip.
 *
 * `key` may be a freshly-typed key (test before saving) or a decrypted stored
 * key; it is used only for this request and never returned.
 */
export async function testConnection(args: {
  providerId: string;
  modelId: string;
  key: string;
  /** Override base URL for the custom OpenAI-compatible provider. */
  baseUrl?: string;
}): Promise<ConnectionTestResult> {
  const provider = findProvider(args.providerId);
  const baseUrl = args.baseUrl?.trim() || provider?.baseUrl || "";

  if (!baseUrl) {
    return {
      ok: false,
      latencyMs: null,
      message: "No base URL configured for this provider.",
    };
  }
  if (!args.key.trim()) {
    return { ok: false, latencyMs: null, message: "No API key provided." };
  }

  const adapter = createOpenAIProvider({
    baseUrl,
    apiKey: args.key,
    model: args.modelId,
    name: args.providerId,
  });

  const started = Date.now();
  try {
    await adapter.complete({
      system: "You are a connection test. Reply with the single word: ok.",
      user: "ping",
      temperature: 0,
      signal: AbortSignal.timeout(12_000),
    });
    return {
      ok: true,
      latencyMs: Date.now() - started,
      message: "Connection succeeded.",
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: `Connection failed: ${detail}`,
    };
  }
}
