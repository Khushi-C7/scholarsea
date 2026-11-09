import { AppError } from "@/lib/auth/errors";

/**
 * The search provider could not be reached (network blocked, DNS failure,
 * timeout, or a non-2xx that is not a rate limit). The UI shows this honestly
 * and displays NO results — it never falls back to fabricated data.
 */
export class SearchUnavailableError extends AppError {
  constructor(
    message = "Academic search is unavailable right now. arXiv could not be reached."
  ) {
    super(message, 503, "search_unavailable");
  }
}

/** arXiv rate limit hit (HTTP 429, or our own min-interval guard). */
export class SearchRateLimitedError extends AppError {
  constructor(
    message = "arXiv is rate-limiting requests. Please wait a few seconds and try again."
  ) {
    super(message, 429, "search_rate_limited");
  }
}

/** The query was empty or malformed. */
export class SearchQueryError extends AppError {
  constructor(message = "Enter a search term.") {
    super(message, 400, "search_bad_query");
  }
}
