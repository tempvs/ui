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
