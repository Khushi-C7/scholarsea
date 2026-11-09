/** Centralized ingestion limits. */
export const LIMITS = {
  /** Max accepted PDF upload size. */
  MAX_PDF_BYTES: 20 * 1024 * 1024, // 20 MB
  /** Max accepted pasted-text length. */
  MAX_TEXT_CHARS: 2_000_000,
  /** Minimum text to be worth ingesting. */
  MIN_TEXT_CHARS: 20,
  /** Max bytes to download from a URL. */
  MAX_FETCH_BYTES: 25 * 1024 * 1024, // 25 MB
  /** URL fetch timeout. */
  FETCH_TIMEOUT_MS: 15_000,
  /** Max redirect hops when fetching a URL. */
  MAX_REDIRECTS: 3,
} as const;

export const PDF_MIME = "application/pdf";
