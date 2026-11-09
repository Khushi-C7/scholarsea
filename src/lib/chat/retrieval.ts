/**
 * Real retrieval over a conversation's corpus. Pure and deterministic (no
 * embeddings/network — a lexical BM25-style ranker), so it is fully testable
 * and works offline. The corpus handed in is already owner- and scope-filtered
 * by the caller, so retrieval can never reach another user's papers.
 */
import { tokens as rawTokens } from "@/lib/gaps/text";
import type { RetrievalDoc, RetrievedPassage } from "@/lib/chat/types";

/**
 * Conservative stemmer so query and passage word-forms match (e.g. "condition"
 * ↔ "conditions", "robustness" ↔ "robust"). Deliberately light — enough to
 * bridge common inflections without aggressive truncation.
 */
function stem(word: string): string {
  let w = word.replace(/'s$/, "");
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ness")) w = w.slice(0, -4);
  else if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s")) w = w.slice(0, -1);
  return w;
}

/** Stemmed content tokens for retrieval matching. */
function tokens(text: string): string[] {
  return rawTokens(text).map(stem);
}

const CHUNK_CHARS = 700;
const CHUNK_OVERLAP = 150;

/** Split text into overlapping, sentence-aware-ish chunks. */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= CHUNK_CHARS) return clean ? [clean] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_CHARS, clean.length);
    // Prefer to break at a sentence boundary near the end of the window.
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const lastStop = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("! ")
      );
      if (lastStop > CHUNK_CHARS * 0.5) end = start + lastStop + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

interface Unit {
  paperId: string;
  paperTitle: string;
  passage: string;
  tokens: string[];
}

/** Build retrieval units from the corpus: claim passages + text chunks. */
function buildUnits(docs: RetrievalDoc[]): Unit[] {
  const units: Unit[] = [];
  for (const d of docs) {
    for (const p of d.claimPassages) {
      const t = tokens(p);
      if (t.length) units.push({ paperId: d.paperId, paperTitle: d.paperTitle, passage: p, tokens: t });
    }
    if (d.fullText) {
      for (const c of chunkText(d.fullText)) {
        const t = tokens(c);
        if (t.length) units.push({ paperId: d.paperId, paperTitle: d.paperTitle, passage: c, tokens: t });
      }
    }
  }
  return units;
}

export interface RetrieveOptions {
  topK?: number;
  /**
   * How many distinct query terms a passage must contain to be relevant.
   * Defaults adapt to query length so relevance does not depend on corpus
   * size: 1 term for short queries (≤2 content terms), else 2.
   */
  minMatchedTerms?: number;
}

export interface RetrievalResult {
  passages: RetrievedPassage[];
  /** True when nothing cleared the relevance threshold. */
  insufficient: boolean;
  /** How many retrieval units existed in the corpus at all. */
  corpusUnits: number;
}

/**
 * Retrieve the most relevant passages for a query using BM25-style scoring
 * with query-term coverage. Returns an explicit `insufficient` flag when the
 * corpus has nothing relevant, so the caller can abstain rather than invent.
 */
export function retrieve(
  query: string,
  docs: RetrievalDoc[],
  opts: RetrieveOptions = {}
): RetrievalResult {
  const topK = opts.topK ?? 6;

  const units = buildUnits(docs);
  const qTerms = Array.from(new Set(tokens(query)));
  if (units.length === 0 || qTerms.length === 0) {
    return { passages: [], insufficient: true, corpusUnits: units.length };
  }
  // Relevance is gated on query-term coverage, not an absolute BM25 score, so
  // a correct match in a one-paper corpus still counts (IDF → 0 when N is tiny).
  const requiredMatches =
    opts.minMatchedTerms ?? (qTerms.length <= 2 ? 1 : 2);

  // Document frequency per term across units.
  const df = new Map<string, number>();
  for (const u of units) {
    for (const t of new Set(u.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = units.length;
  const avgLen = units.reduce((s, u) => s + u.tokens.length, 0) / N;
  const k1 = 1.5;
  const b = 0.75;

  const scored = units.map((u) => {
    const tf = new Map<string, number>();
    for (const t of u.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    let matchedTerms = 0;
    for (const q of qTerms) {
      const f = tf.get(q);
      if (!f) continue;
      matchedTerms += 1;
      const n = df.get(q) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const denom = f + k1 * (1 - b + (b * u.tokens.length) / avgLen);
      score += idf * ((f * (k1 + 1)) / denom);
    }
    // Reward covering more distinct query terms (penalizes one-word flukes).
    const coverage = matchedTerms / qTerms.length;
    return { u, score: score * (0.5 + 0.5 * coverage), matchedTerms };
  });

  const ranked = scored
    .filter((s) => s.matchedTerms >= requiredMatches)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, topK);

  const passages: RetrievedPassage[] = ranked.map((s, i) => ({
    passageId: `P${i + 1}`,
    paperId: s.u.paperId,
    paperTitle: s.u.paperTitle,
    passage: s.u.passage,
    score: Number(s.score.toFixed(4)),
  }));

  return {
    passages,
    insufficient: passages.length === 0,
    corpusUnits: units.length,
  };
}
