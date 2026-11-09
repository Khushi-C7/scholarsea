/**
 * Pure text utilities for deterministic pattern detection. No external deps,
 * no DB — easy to unit test. These power the heuristic clustering and conflict
 * detection in patterns.ts.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "we", "our", "this", "that", "these", "those", "is", "are", "was", "were",
  "be", "been", "it", "its", "as", "by", "at", "from", "not", "no", "do",
  "does", "did", "can", "could", "may", "might", "will", "would", "which",
  "their", "they", "them", "than", "then", "also", "such", "using", "used",
  "use", "based", "approach", "method", "methods", "paper", "study", "work",
  "results", "result", "however", "while", "when", "where", "more", "most",
  "under", "over", "between", "across", "into", "about", "per",
]);

/** Lowercase content tokens (length ≥ 3, not stopwords, not pure numbers). */
export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []).filter(
    (t) => !STOPWORDS.has(t)
  );
}

/** Distinct content tokens as a set. */
export function tokenSet(text: string): Set<string> {
  return new Set(tokens(text));
}

/** Jaccard overlap of two token sets (0..1). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/**
 * Cluster strings by token overlap. Two items join the same cluster when their
 * Jaccard similarity ≥ threshold. Greedy single-link; good enough for grouping
 * paraphrased limitations / future-work across papers.
 */
export interface Clustered<T> {
  items: T[];
  /** Shared tokens that define the cluster theme. */
  sharedTokens: string[];
}

export function clusterByOverlap<T>(
  items: T[],
  getText: (item: T) => string,
  threshold = 0.18
): Clustered<T>[] {
  const sets = items.map((i) => tokenSet(getText(i)));
  const used = new Array(items.length).fill(false);
  const clusters: Clustered<T>[] = [];

  for (let i = 0; i < items.length; i++) {
    if (used[i]) continue;
    const members = [i];
    used[i] = true;
    for (let j = i + 1; j < items.length; j++) {
      if (used[j]) continue;
      if (members.some((m) => jaccard(sets[m], sets[j]) >= threshold)) {
        members.push(j);
        used[j] = true;
      }
    }
    const shared = new Set<string>(sets[members[0]]);
    for (const m of members.slice(1)) {
      for (const t of Array.from(shared)) if (!sets[m].has(t)) shared.delete(t);
    }
    clusters.push({
      items: members.map((m) => items[m]),
      sharedTokens: Array.from(shared),
    });
  }
  return clusters;
}

// --- Conflict / polarity detection -----------------------------------------

const NEGATIVE = [
  "not", "no", "fail", "fails", "failed", "drop", "drops", "degrade",
  "degrades", "degradation", "poor", "worse", "cannot", "lack", "lacks",
  "limited", "limitation", "untested", "unable", "struggle", "struggles",
  "weak", "insufficient", "absent", "missing", "without",
];

const POSITIVE = [
  "achieve", "achieves", "achieved", "improve", "improves", "improved",
  "outperform", "outperforms", "robust", "strong", "effective", "success",
  "successful", "gains", "gain", "better", "addresses", "addressed", "solves",
  "handles", "closes",
];

export type Polarity = "positive" | "negative" | "neutral";

/** Rough sentiment polarity of a claim/sentence, for conflict detection. */
export function polarity(text: string): Polarity {
  const toks = new Set(tokens(text).concat(text.toLowerCase().match(/\bnot\b|\bno\b/g) ?? []));
  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE) if (toks.has(w)) pos += 1;
  for (const w of NEGATIVE) if (toks.has(w)) neg += 1;
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

/** Keyword families for "missing evaluation" detection. */
export const EVALUATION_ASPECTS: { key: string; label: string; words: string[] }[] = [
  {
    key: "robustness",
    label: "robustness / field-condition evaluation",
    words: ["robust", "robustness", "field", "in-the-wild", "noise", "noisy", "adversarial", "distribution", "shift"],
  },
  {
    key: "generalization",
    label: "cross-domain generalization",
    words: ["generaliz", "cross-domain", "transfer", "unseen", "out-of-distribution", "ood", "domain"],
  },
  {
    key: "deployment",
    label: "real-world deployment / efficiency evaluation",
    words: ["deploy", "deployment", "latency", "real-time", "inference", "efficiency", "edge", "production", "throughput"],
  },
];

/** Does the text mention any word in the family? */
export function mentionsAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w));
}
