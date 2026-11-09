import { LIMITS } from "@/lib/documents/limits";
import { looksLikePdf } from "@/lib/documents/pdf";
import {
  UnsupportedFileTypeError,
  FileTooLargeError,
  EmptyContentError,
} from "@/lib/documents/errors";

/**
 * Validate an uploaded PDF. Trusts the file's magic bytes, not the declared
 * MIME type or filename extension (both are trivially spoofed). Throws on
 * failure.
 */
export function validatePdfUpload(bytes: Buffer): void {
  if (bytes.length === 0) {
    throw new EmptyContentError("The uploaded file is empty");
  }
  if (bytes.length > LIMITS.MAX_PDF_BYTES) {
    throw new FileTooLargeError(
      `PDF exceeds the ${Math.round(LIMITS.MAX_PDF_BYTES / (1024 * 1024))} MB limit`
    );
  }
  if (!looksLikePdf(bytes)) {
    throw new UnsupportedFileTypeError("The file is not a valid PDF");
  }
}

/** Validate pasted text length. Throws on failure. */
export function validateTextInput(text: string): void {
  const trimmedLength = text.trim().length;
  if (trimmedLength < LIMITS.MIN_TEXT_CHARS) {
    throw new EmptyContentError(
      `Please provide at least ${LIMITS.MIN_TEXT_CHARS} characters of text`
    );
  }
  if (text.length > LIMITS.MAX_TEXT_CHARS) {
    throw new FileTooLargeError("The pasted text is too long");
  }
}

/** Decide how to treat fetched bytes based on content type and magic bytes. */
export function classifyFetched(
  bytes: Buffer,
  contentType: string
): "pdf" | "html" {
  if (looksLikePdf(bytes)) return "pdf";
  const ct = contentType.toLowerCase();
  if (ct.includes("application/pdf")) return "pdf";
  return "html";
}
