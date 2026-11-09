import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { getServerEnv } from "@/lib/env";

/**
 * Singleton Prisma client.
 *
 * Prisma 7 is "Rust-free": the client talks to PostgreSQL through the `pg`
 * driver adapter rather than a native query engine. We construct one adapter
 * + client per process and cache it on `globalThis` in development so Next's
 * hot-reload does not open a new connection pool on every change.
 */
function createPrismaClient(): PrismaClient {
  const { DATABASE_URL, NODE_ENV } = getServerEnv();
  const adapter = new PrismaPg({ connectionString: DATABASE_URL });
  return new PrismaClient({
    adapter,
    log:
      NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
