/**
 * Typed auth/authorization errors. Each carries an HTTP status so route
 * handlers can translate them into safe responses without leaking details.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Not authenticated — no valid session. */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "unauthorized");
  }
}

/** Authenticated, but not allowed to access this resource. */
export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource") {
    super(message, 403, "forbidden");
  }
}

/**
 * Resource not found OR not owned by the caller. We deliberately return 404
 * (not 403) for another user's resource so existence is not revealed.
 */
export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "not_found");
  }
}

/** Invalid credentials on login. Intentionally vague. */
export class InvalidCredentialsError extends AppError {
  constructor(message = "Invalid email or password") {
    super(message, 401, "invalid_credentials");
  }
}

/** Signup conflict: email already registered. */
export class EmailInUseError extends AppError {
  constructor(message = "An account with this email already exists") {
    super(message, 409, "email_in_use");
  }
}
