import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end config (section 9). Runs the production server against the test
 * database and drives it with the Chromium build pre-installed in the image.
 *
 * Point E2E at its own DB with E2E_DATABASE_URL (defaults to the local test
 * database). The server is started by Playwright on PORT below.
 */
const PORT = Number(process.env.E2E_PORT ?? 3310);
const baseURL = `http://127.0.0.1:${PORT}`;

// Prefer an explicitly pinned Chromium binary when present (the CI image ships
// one); otherwise fall back to Playwright's managed download.
const CHROMIUM_CANDIDATES = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "",
].filter(Boolean);
const executablePath = CHROMIUM_CANDIDATES.find((p) => existsSync(p));

const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  "postgresql://scholarsea:scholarsea@127.0.0.1:5432/scholarsea_test?schema=public";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    headless: true,
    trace: "on-first-retry",
    ...(executablePath
      ? { launchOptions: { executablePath, args: ["--no-sandbox"] } }
      : { launchOptions: { args: ["--no-sandbox"] } }),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: databaseUrl,
      AUTH_SECRET:
        process.env.AUTH_SECRET ?? "e2e-secret-at-least-16-characters-long",
      NODE_ENV: "production",
    },
  },
});
