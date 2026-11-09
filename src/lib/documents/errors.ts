import { AppError } from "@/lib/auth/errors";

/** URL rejected by SSRF / protocol checks. */
export class SsrfError extends AppError {
  constructor(message = "This URL is not allowed") {
    super(message, 400, "blocked_url");
  }
}

/** Uploaded/fetched file is not an accepted type. */
export class UnsupportedFileTypeError extends AppError {
  constructor(message = "Unsupported file type") {
    super(message, 415, "unsupported_file_type");
  }
}

/** Input exceeds the configured size limit. */
export class FileTooLargeError extends AppError {
  constructor(message = "File is too large") {
    super(message, 413, "file_too_large");
  }
}

/** The same content has already been ingested by this user. */
export class DuplicatePaperError extends AppError {
  constructor(
    readonly existingPaperId: string,
    message = "You have already added this paper"
  ) {
    super(message, 409, "duplicate_paper");
  }
}

/** Remote fetch failed (network error, non-2xx, timeout, too large). */
export class FetchError extends AppError {
  constructor(message = "Could not fetch the document") {
    super(message, 502, "fetch_failed");
  }
}

/** The source yielded no usable content. */
export class EmptyContentError extends AppError {
  constructor(message = "No readable content could be extracted") {
    super(message, 422, "empty_content");
  }
}
