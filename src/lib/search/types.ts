/**
 * Academic search (arXiv) — shared, client-safe types. Every ArxivResult
 * corresponds to a real parsed entry from the arXiv Atom feed; the app never
 * synthesizes results.
 */

export interface ArxivResult {
  /** arXiv id without version, e.g. "2305.01234". */
  arxivId: string;
  /** Version suffix if present, e.g. "v2". */
  version: string | null;
  title: string;
  authors: string[];
  /** Publication year from the published date, if parseable. */
  year: number | null;
  /** Full published date (ISO) when available. */
  published: string | null;
  abstract: string | null;
  /** Primary + secondary arXiv categories, e.g. ["cs.CV"]. */
  categories: string[];
  /** Canonical abstract page URL. */
  url: string;
  /** PDF URL when advertised. */
  pdfUrl: string | null;
  doi: string | null;
}

export interface SearchQuery {
  keyword?: string;
  title?: string;
  author?: string;
  yearFrom?: number;
  yearTo?: number;
  start?: number;
  maxResults?: number;
}

export interface SearchResponse {
  results: ArxivResult[];
  /** Total hits arXiv reports for the query (may exceed returned count). */
  totalResults: number;
  start: number;
}
