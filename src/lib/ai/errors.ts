import { AppError } from "@/lib/auth/errors";

/** The provider call failed (network, non-2xx, timeout). */
export class AIProviderError extends AppError {
  constructor(message = "The AI provider request failed") {
    super(message, 502, "ai_provider_error");
  }
}

/** The model's output could not be parsed/validated after all retries. */
export class AIValidationError extends AppError {
  constructor(
    message = "The AI response did not match the expected format",
    readonly detail?: string
  ) {
    super(message, 502, "ai_validation_error");
  }
}

/** The analysis could not run because the paper has no usable text. */
export class NotAnalyzableError extends AppError {
  constructor(message = "This paper has no extracted text to analyze") {
    super(message, 422, "not_analyzable");
  }
}
