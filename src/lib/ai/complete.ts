import type { ZodType } from "zod";

import type { AIProvider, TokenUsage } from "@/lib/ai/types";
import { ZERO_USAGE, addUsage } from "@/lib/ai/types";
import { AIValidationError } from "@/lib/ai/errors";

export interface CompleteJsonArgs<T> {
  provider: AIProvider;
  schema: ZodType<T>;
  system: string;
  user: string;
  /** Deterministic output used when the provider is the demo provider. */
  demo: () => T;
  temperature?: number;
  /** Extra attempts after the first (default 2 ⇒ up to 3 total). */
  maxRetries?: number;
  /** Per-attempt timeout in ms (default 30000). */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface CompleteJsonResult<T> {
  data: T;
  usage: TokenUsage;
  attempts: number;
  demo: boolean;
}

/** Strip Markdown code fences and isolate the JSON object/array. */
export function extractJson(text: string): string {
  let t = text.trim();
  // Remove a leading ```json / ``` fence and trailing ```.
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // If there's prose around the JSON, slice to the outermost braces/brackets.
  const firstObj = t.indexOf("{");
  const firstArr = t.indexOf("[");
  const start =
    firstArr === -1
      ? firstObj
      : firstObj === -1
        ? firstArr
        : Math.min(firstObj, firstArr);
  if (start > 0) {
    const lastObj = t.lastIndexOf("}");
    const lastArr = t.lastIndexOf("]");
    const end = Math.max(lastObj, lastArr);
    if (end > start) t = t.slice(start, end + 1);
  }
  return t;
}

/**
 * Call the provider and return output validated against `schema`. On the demo
 * provider, returns the supplied demo() output (still schema-validated). On a
 * real provider, retries on provider error, bad JSON, or schema mismatch, with
 * a per-attempt timeout, nudging the model toward valid JSON between attempts.
 */
export async function completeJson<T>(
  args: CompleteJsonArgs<T>
): Promise<CompleteJsonResult<T>> {
  const { provider, schema, demo } = args;

  if (provider.isDemo) {
    // Validate the demo output too, so a broken demo generator is caught.
    return {
      data: schema.parse(demo()),
      usage: ZERO_USAGE,
      attempts: 0,
      demo: true,
    };
  }

  const maxRetries = args.maxRetries ?? 2;
  const timeoutMs = args.timeoutMs ?? 30_000;
  let usage: TokenUsage = ZERO_USAGE;
  let lastError = "unknown error";
  let userMessage = args.user;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    args.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await provider.complete({
        system: args.system,
        user: userMessage,
        temperature: args.temperature,
        json: true,
        signal: controller.signal,
      });
      usage = addUsage(usage, res.usage);

      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJson(res.text));
      } catch {
        lastError = "response was not valid JSON";
        userMessage = `${args.user}\n\nYour previous reply was not valid JSON. Reply with ONLY a single valid JSON value, no prose or code fences.`;
        continue;
      }

      const result = schema.safeParse(parsed);
      if (result.success) {
        return { data: result.data, usage, attempts: attempt, demo: false };
      }
      lastError = result.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      userMessage = `${args.user}\n\nYour previous reply did not match the required schema (${lastError}). Reply with ONLY corrected JSON.`;
    } catch (err) {
      lastError =
        err instanceof Error ? err.message : "provider error";
      // retry on provider/timeout errors
    } finally {
      clearTimeout(timer);
      args.signal?.removeEventListener("abort", onAbort);
    }
  }

  throw new AIValidationError(
    "The AI response could not be validated after retries",
    lastError
  );
}
