import { config } from "dotenv";

// Optional local overrides.
config({ path: ".env.test" });

/**
 * Force the test database, overriding any inherited DATABASE_URL so tests can
 * never accidentally write to the dev database. CI can point TEST_DATABASE_URL
 * at its own database.
 */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://scholarsea:scholarsea@127.0.0.1:5432/scholarsea_test?schema=public";

process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? "test-secret-at-least-16-characters-long";
