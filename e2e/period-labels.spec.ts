import { expect, test } from "@playwright/test";

test("public Library breadcrumb period names omit date guidance", async ({ page }) => {
  await page.goto("/library/period/interwar");
  await expect(page.getByRole("link", { name: "Interwar", exact: true }).first()).toBeVisible();
  await page.locator('button[id^="library-period-switcher-"]').first().click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("link", { name: "Early modern", exact: true })).toBeVisible();
  await expect(menu).not.toContainText(/\d/);
});

for (const path of ["/clubs", "/events"]) {
  test(`public ${path} period filters omit date guidance`, async ({ page }) => {
    await page.goto(path);
    const filters = page.locator(".catalogue-search-filters, .event-search-filters");
    await filters.locator(".catalogue-filter-disclosure > summary").click();
    await expect(filters.getByRole("checkbox", { name: "Interwar", exact: true })).toBeVisible();
    await expect(filters.getByRole("checkbox", { name: "Modern / pre-WWI", exact: true })).toBeVisible();
    await expect(filters.locator(".period-multi-select-checkboxes")).not.toContainText(/\d/);
    await filters.getByText("Interwar", { exact: true }).hover();
    const tooltip = page.getByRole("tooltip").filter({ hasText: /^1918–1939$/ });
    await expect(tooltip).toBeVisible();
    const labelBounds = (await filters.getByText("Interwar", { exact: true }).boundingBox())!;
    const tooltipBounds = (await tooltip.boundingBox())!;
    const gap = tooltipBounds.x - labelBounds.x - labelBounds.width;
    expect(gap).toBeGreaterThan(16);
    expect(gap).toBeLessThan(40);
  });
}
