import { expect, test } from "@playwright/test";

test("public landing explains Tempvs and offers authentication", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome to Tempvs!" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("public discovery pages stay reachable without a member session", async ({ page }) => {
  for (const path of ["/clubs", "/events", "/library", "/map"]) {
    await page.goto(path);
    await expect(page.locator("main, .page-layout-content, .map-page").first()).toBeVisible();
  }
});

test("an authenticated fixture account sees the guided home or its Wall", async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "Requires E2E_EMAIL and E2E_PASSWORD fixture credentials.");
  await page.goto("/");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Bring your history to life").or(page.getByRole("heading", { name: "Your wall" }))).toBeVisible();
});
