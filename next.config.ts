import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages in this app are authenticated and per-user, so they render
  // dynamically. We don't opt into Cache Components / Partial Prerendering
  // (which would require Suspense around every cookies()/db access).

  // Keep server-only DB packages out of the client/edge bundles.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
