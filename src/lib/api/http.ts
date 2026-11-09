import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

import { AppError } from "@/lib/auth/errors";

/** JSON success response. */
export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/** JSON error envelope. */
function errorResponse(
  message: string,
  status: number,
  code: string,
  details?: unknown
): NextResponse {
  return NextResponse.json({ error: { message, code, details } }, { status });
}

/**
 * Parse and validate a JSON request body against a Zod schema. Throws a
 * ZodError on invalid input, which handleRouteError turns into a 400.
 */
export async function parseJson<T>(
  req: Request,
  schema: ZodType<T>
): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ZodError([
      {
        code: "custom",
        path: [],
        message: "Request body must be valid JSON",
        input: undefined,
      },
    ]);
  }
  return schema.parse(body);
}

/**
 * Translate any thrown value into a safe HTTP response. Known AppErrors keep
 * their status/code; validation errors become 400 with field details;
 * everything else becomes a generic 500 with no internal detail leaked.
 */
export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return errorResponse(err.message, err.status, err.code);
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return errorResponse("Invalid request", 400, "validation_error", details);
  }
  // Unknown error — log server-side, return a generic message.
  console.error("Unhandled route error:", err);
  return errorResponse("Something went wrong", 500, "internal_error");
}
