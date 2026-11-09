import "server-only";

import type { AIProvider } from "@/lib/ai/types";
import { createOpenAIProvider } from "@/lib/ai/openai";
import { createDemoProvider } from "@/lib/ai/demo";
import { getServerEnv } from "@/lib/env";
import { findProvider } from "@/lib/ai/catalog";
import { getPreferences, getDecryptedKey } from "@/lib/preferences/service";

/**
 * Resolve the active AI provider. When an API key and base URL are configured,
 * use the OpenAI-compatible adapter; otherwise fall back to the clearly-labeled
 * demo provider. (Per-user encrypted keys from Settings can override this in a
 * later step.)
 */
export function getProvider(): AIProvider {
  const env = getServerEnv();
  if (env.AI_API_KEY && env.AI_BASE_URL) {
    return createOpenAIProvider({
      baseUrl: env.AI_BASE_URL,
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL ?? "gpt-4o-mini",
      name: env.AI_PROVIDER ?? "openai",
    });
  }
  return createDemoProvider();
}

export function isDemoMode(): boolean {
  return getProvider().isDemo;
}

/**
 * Resolve the provider for a specific user. A user's Settings choice (provider
 * + model) backed by a stored, encrypted key takes precedence; the decrypted
 * key is used only to construct the adapter here on the server and is never
 * returned. Falls back to the environment-configured provider, then demo.
 */
export async function getProviderForUser(userId: string): Promise<AIProvider> {
  const prefs = await getPreferences(userId);
  const providerInfo = findProvider(prefs.aiProvider);

  if (providerInfo && providerInfo.requiresKey && prefs.aiModel) {
    const key = await getDecryptedKey(userId, providerInfo.id);
    if (key) {
      const env = getServerEnv();
      const baseUrl =
        providerInfo.baseUrl || env.AI_BASE_URL || "https://api.openai.com/v1";
      return createOpenAIProvider({
        baseUrl,
        apiKey: key,
        model: prefs.aiModel,
        name: providerInfo.id,
      });
    }
  }
  return getProvider();
}
