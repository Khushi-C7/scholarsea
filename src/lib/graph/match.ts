/**
 * Resolve a citation/reference string to a paper already in the user's
 * library. Pure and deterministic (no DB), so it is unit-tested directly.
 *
 * Matching is deliberately conservative — a reference becomes a graph edge
 * only when it clearly points at a known paper (shared DOI, arXiv id, or the
 * full normalized title appearing in the reference text). Anything weaker is
 * left unmatched rather than inventing a citation edge.
 */

export interface MatchablePaper {
  id: string;
  title: string;
  doi: string | null;
  arxivId: string | null;
}

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDoi(s: string): string {
  return s.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "").trim();
}

/** Minimum normalized-title length to allow a title-substring match. */
const MIN_TITLE_MATCH_LEN = 20;

/**
 * Return the id of the library paper this reference string cites, or null.
 * `selfId` is excluded so a paper can never cite itself.
 */
export function matchReference(
  reference: string,
  papers: MatchablePaper[],
  selfId: string
): string | null {
  const refNorm = normalizeText(reference);
  const refDoi = normalizeDoi(reference);
  if (!refNorm) return null;

  for (const p of papers) {
    if (p.id === selfId) continue;

    // Strongest signals first: DOI, then arXiv id.
    if (p.doi) {
      const d = normalizeDoi(p.doi);
      if (d && refDoi.includes(d)) return p.id;
    }
    if (p.arxivId) {
      const a = p.arxivId.toLowerCase();
      if (a && reference.toLowerCase().includes(a)) return p.id;
    }
  }

  // Title match: the full normalized title must appear in the reference, and
  // be long enough that the match can't be a coincidence.
  for (const p of papers) {
    if (p.id === selfId) continue;
    const t = normalizeText(p.title);
    if (t.length >= MIN_TITLE_MATCH_LEN && refNorm.includes(t)) return p.id;
  }

  return null;
}
