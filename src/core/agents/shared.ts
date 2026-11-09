import type { CompleteJsonResult } from "@/lib/ai/complete";

/** Options every agent run accepts. */
export interface AgentRunOptions {
  maxRetries?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export type AgentResult<T> = CompleteJsonResult<T>;

/** Cap text sent to the model to bound token usage. */
export const MAX_PROMPT_CHARS = 24_000;
export function truncateForPrompt(text: string, n = MAX_PROMPT_CHARS): string {
  return text.length <= n ? text : `${text.slice(0, n)}\n…[truncated]`;
}

/** Split text into reasonably-sized sentences. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
}

export function firstSentences(text: string, n: number): string[] {
  return splitSentences(text).slice(0, n);
}

/** Sentences containing any of the given keywords. */
export function sentencesMatching(
  text: string,
  words: string[],
  limit: number
): string[] {
  const re = new RegExp(`\\b(${words.join("|")})`, "i");
  return splitSentences(text)
    .filter((s) => re.test(s))
    .slice(0, limit);
}

const KNOWN_SECTIONS = [
  "Abstract",
  "Introduction",
  "Related Work",
  "Background",
  "Methodology",
  "Methods",
  "Method",
  "Approach",
  "Experiments",
  "Results",
  "Evaluation",
  "Discussion",
  "Conclusion",
  "Conclusions",
  "References",
  "Future Work",
];

/** Headings that appear in the text, for the demo Reader. */
export function detectSections(text: string): string[] {
  return KNOWN_SECTIONS.filter((h) =>
    new RegExp(`(^|\\n)\\s*\\d*\\.?\\s*${h}\\b`, "i").test(text)
  );
}

/** Candidate technical terms: acronyms and Capitalized multi-word phrases. */
export function candidateTerms(text: string, limit: number): string[] {
  const found = new Set<string>();
  for (const m of text.match(/\b[A-Z]{2,6}\b/g) ?? []) {
    if (!["THE", "AND", "FOR", "WITH", "THIS"].includes(m)) found.add(m);
  }
  for (const m of text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})\b/g) ?? []) {
    found.add(m);
  }
  return Array.from(found).slice(0, limit);
}

/** Non-null, non-empty fallback so demo output always satisfies min(1). */
export function orFallback(value: string | undefined, fallback: string): string {
  const v = value?.trim();
  return v && v.length > 0 ? v : fallback;
}
