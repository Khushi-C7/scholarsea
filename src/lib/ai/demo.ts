import type { AIProvider, CompletionResult } from "@/lib/ai/types";
import { ZERO_USAGE } from "@/lib/ai/types";

/**
 * Offline, simulated provider used when no API key is configured. Agents
 * supply their own deterministic demo output to completeJson, so this
 * provider's complete() is never exercised on the demo path — it exists only
 * to satisfy the interface.
 */
export function createDemoProvider(): AIProvider {
  return {
    name: "demo",
    model: "demo-heuristic",
    isDemo: true,
    async complete(): Promise<CompletionResult> {
      return { text: "{}", usage: ZERO_USAGE };
    },
  };
}
