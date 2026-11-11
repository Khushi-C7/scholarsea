import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration (plain ESM JavaScript so it loads on any build
 * environment without a TypeScript transpiler). The CLI reads this for
 * `generate`, `migrate`, and `db` commands. Runtime database access goes
 * through a driver adapter in src/lib/db/prisma.ts, not through this file.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
    shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
