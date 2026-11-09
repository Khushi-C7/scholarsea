import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Resolve the "@/..." path aliases from tsconfig in tests.
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      {
        // `server-only` throws outside a React Server Component; in the Node
        // test runtime we replace it with an empty module.
        find: /^server-only$/,
        replacement: fileURLToPath(
          new URL("./tests/stubs/server-only.ts", import.meta.url)
        ),
      },
    ],
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Integration tests share one test database, so run files serially to
    // avoid cross-test interference.
    fileParallelism: false,
  },
});
