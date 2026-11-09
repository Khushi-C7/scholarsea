import { createHash } from "node:crypto";

/** SHA-256 hex digest of a buffer or string. */
export function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Normalize text so that trivially-different copies of the same document
 * (whitespace, line endings, case) hash to the same value for duplicate
 * detection.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Content hash for text-derived sources (pasted text, HTML). */
export function contentHashFromText(text: string): string {
  return sha256(normalizeText(text));
}

/** Content hash for binary sources (uploaded/fetched PDFs). */
export function contentHashFromBytes(bytes: Buffer): string {
  return sha256(bytes);
}
