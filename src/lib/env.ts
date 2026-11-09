import { z } from "zod";

/**
 * Server-side environment validation. Import this only from server code
 * (route handlers, server components, scripts) — it reads process.env and
 * must never ship to the browser. Browser-safe values use NEXT_PUBLIC_*.
 */
const serverSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
      "DATABASE_URL must be a PostgreSQL connection string"
    ),
  SHADOW_DATABASE_URL: z.string().optional(),
  // Secret used to sign session JWTs. Must be long and random in production.
  AUTH_SECRET: z
    .string()
    .min(16, "AUTH_SECRET must be at least 16 characters"),
  CREDENTIAL_ENCRYPTION_KEY: z.string().optional(),
  AI_PROVIDER: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

/** Parse and cache server env, throwing a readable error if anything invalid. */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
