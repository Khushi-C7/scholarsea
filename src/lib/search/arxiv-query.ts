import type { SearchQuery } from "@/lib/search/types";
import { SearchQueryError } from "@/lib/search/errors";

export const ARXIV_API = "https://export.arxiv.org/api/query";
export const MAX_RESULTS_CAP = 50;

/** Quote a term for an arXiv field query, escaping embedded quotes. */
function term(value: string): string {
  const v = value.trim().replace(/["\\]/g, " ");
  // Wrap multi-word phrases in quotes so arXiv treats them as a phrase.
  return /\s/.test(v) ? `"${v}"` : v;
}

/**
 * Build the arXiv API query URL from structured inputs. Pure and
 * deterministic (no network), so it is unit-tested directly.
 *
 * - keyword → all:  · title → ti:  · author → au:
 * - year range → submittedDate:[YYYYMMDD TO YYYYMMDD]
 * Clauses are AND-combined. Throws SearchQueryError when nothing is searchable.
 */
export function buildArxivUrl(q: SearchQuery): string {
  const clauses: string[] = [];
  if (q.keyword?.trim()) clauses.push(`all:${term(q.keyword)}`);
  if (q.title?.trim()) clauses.push(`ti:${term(q.title)}`);
  if (q.author?.trim()) clauses.push(`au:${term(q.author)}`);

  if (q.yearFrom || q.yearTo) {
    const from = q.yearFrom ?? 1991; // arXiv's first year
    const to = q.yearTo ?? new Date().getFullYear();
    clauses.push(`submittedDate:[${from}0101 TO ${to}1231]`);
  }

  if (clauses.length === 0) {
    throw new SearchQueryError();
  }

  const searchQuery = clauses.join(" AND ");
  const start = Math.max(0, q.start ?? 0);
  const maxResults = Math.min(MAX_RESULTS_CAP, Math.max(1, q.maxResults ?? 15));

  const params = new URLSearchParams({
    search_query: searchQuery,
    start: String(start),
    max_results: String(maxResults),
    sortBy: "relevance",
    sortOrder: "descending",
  });
  return `${ARXIV_API}?${params.toString()}`;
}
