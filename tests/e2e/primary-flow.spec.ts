import { test, expect } from "@playwright/test";

/**
 * Primary user workflow (section 9 E2E): sign up, see an empty state, ingest a
 * paper, see it in the library, and confirm it persists after reload. Also
 * checks responsive navigation and an auth-protected redirect.
 *
 * Each run uses a unique email so repeated runs don't collide.
 */
const unique = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `${unique}@example.test`;
const password = "e2e-password-123";
const paperTitle = `E2E Few-Shot Study ${unique}`;
const paperText =
  "We present a prototypical metric-learning method for few-shot plant leaf " +
  "disease classification, evaluated on the PlantVillage dataset with accuracy " +
  "and F1 metrics. This is end-to-end test content with enough length to ingest.";

test.describe.configure({ mode: "serial" });

test("unauthenticated user is sent to login", async ({ page }) => {
  await page.goto("/library");
  await expect(page).toHaveURL(/\/login/);
});

test("sign up, ingest, persist, and navigate", async ({ page }) => {
  // --- Sign up ---------------------------------------------------------
  await page.goto("/signup");
  await page.fill("#name", "E2E Tester");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /sign up|create account/i }).click();

  // Lands on an authenticated page (dashboard at /).
  await expect(page).toHaveURL(/\/$|\/(dashboard)?$/);

  // --- Empty state in the library -------------------------------------
  await page.goto("/library");
  await expect(page.getByText(/no papers yet/i)).toBeVisible();

  // --- Ingest a paper via pasted text ---------------------------------
  await page.goto("/new");
  await page.fill("#title", paperTitle);
  await page.fill("#text", paperText);
  await page.getByRole("button", { name: /add paper/i }).click();

  // Success surface: a link to the library appears.
  await expect(
    page.getByRole("link", { name: /go to library/i })
  ).toBeVisible();

  // --- Appears in the library, and persists after reload --------------
  await page.goto("/library");
  await expect(page.getByText(paperTitle)).toBeVisible();
  await page.reload();
  await expect(page.getByText(paperTitle)).toBeVisible();
});

test("responsive navigation exposes the mobile menu", async ({ page }) => {
  // Re-authenticate in this fresh context.
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await expect(page).toHaveURL(/\/$|\/(dashboard)?$/);

  // Narrow viewport: the mobile menu trigger is visible and opens the nav.
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/library");
  const menu = page.getByRole("button", { name: /open navigation menu/i });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(page.getByRole("link", { name: /library/i }).first()).toBeVisible();
});
