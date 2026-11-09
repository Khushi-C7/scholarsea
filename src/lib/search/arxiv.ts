import "server-only";

import type { SearchQuery, SearchResponse } from "@/lib/search/types";
import { buildArxivUrl } from "@/lib/search/arxiv-query";
import { parseArxivFeed } from "@/lib/search/arxiv-parse";
import {
  SearchUnavailableError,
  SearchRateLimitedError,
} from "@/lib/search/errors";

// arXiv asks clients to space requests ~3s apart and send a descriptive UA.
const MIN_INTERVAL_MS = 3000;
const REQUEST_TIMEOUT_MS = 15000;
const USER_AGENT =
  "ScholarSea/0.1 (research paper manager; mailto:noreply@scholarsea.dev)";

let lastRequestAt = 0;

/**
 * Query arXiv and return parsed results. On any failure — blocked host,
 * timeout, non-2xx, unparseable body — it throws a typed error and NEVER
 * returns fabricated results. Enforces a client-side minimum interval and maps
 * 429/503 to a rate-limit error.
 */
export async function searchArxiv(q: SearchQuery): Promise<SearchResponse> {
  const url = buildArxivUrl(q); // may throw SearchQueryError (empty query)

  // Client-side rate guard so we never hammer arXiv.
  const now = Date.now();
  if (now - lastRequestAt < MIN_INTERVAL_MS) {
    throw new SearchRateLimitedError();
  }
  lastRequestAt = now;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/atom+xml" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Network error, DNS failure, timeout, or a blocked host (this sandbox).
    throw new SearchUnavailableError();
  }

  if (res.status === 429 || res.status === 503) {
    throw new SearchRateLimitedError();
  }
  if (!res.ok) {
    throw new SearchUnavailableError(
      `arXiv returned an unexpected status (${res.status}).`
    );
  }

  let xml: string;
  try {
    xml = await res.text();
  } catch {
    throw new SearchUnavailableError();
  }
  if (!xml.includes("<feed")) {
    // Not the Atom feed we expect — refuse rather than guess.
    throw new SearchUnavailableError("arXiv returned an unrecognized response.");
  }
  return parseArxivFeed(xml);
}
