import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // These public map checks need no member account or live backend.
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
});

test("public map survives WebGL initialization failure and retries without reloading", async ({
  page,
}) => {
  await page.addInitScript(() => {
    // CI uses CRA's development server. Suppress its overlay for this one
    // deliberately injected error so it cannot cover the application's UI.
    // The assertions still require both the page and its recovery UI to work.
    window.addEventListener("error", (event) => {
      if (event.error?.message === "Failed to initialize WebGL") {
        event.stopImmediatePropagation();
      }
    });
    const getContext = HTMLCanvasElement.prototype.getContext;
    (window as any).mapWebglAvailable = false;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: any[]
    ) {
      if (/^webgl2?$/.test(type) && !(window as any).mapWebglAvailable)
        return null;
      return (getContext as any).call(this, type, ...args);
    } as typeof getContext;
  });
  await page.goto("/map");
  const mapAlert = page
    .getByRole("region", { name: "Interactive map", exact: true })
    .getByRole("alert");
  await expect(
    page.getByRole("heading", { name: "Discover places" }),
  ).toBeVisible();
  await expect(mapAlert).toContainText(
    "interactive map could not be displayed",
  );
  // Search and surrounding page state survive even when graphics are unavailable.
  await page.getByRole("combobox", { name: "Place", exact: true }).fill("Rome");
  await page.getByRole("button", { name: "Retry map", exact: true }).click();
  await expect(mapAlert).toBeVisible();
  await page.evaluate(() => {
    (window as any).mapWebglAvailable = true;
  });
  await page.getByRole("button", { name: "Retry map", exact: true }).click();
  await expect(mapAlert).toHaveCount(0);
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
  await expect(page.getByLabel("Interactive world map")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(
    page.getByRole("combobox", { name: "Place", exact: true }),
  ).toHaveValue("Rome");
  await expect(
    page.getByRole("button", { name: "Zoom in", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Discover places" }),
  ).toBeVisible();
});

test("public map restores a lost graphics context and can replace it without losing the page", async ({
  page,
}) => {
  await page.goto("/map");
  const canvas = page.locator("canvas.maplibregl-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByLabel("Interactive world map")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.getByLabel("Map legend")).toBeVisible();
  const loseContext = async () => {
    await canvas.evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      const extension = gl?.getExtension("WEBGL_lose_context");
      if (!extension)
        throw new Error(
          "WEBGL_lose_context is required for this regression test",
        );
      (window as any).restoreMapContext = () => extension.restoreContext();
      extension.loseContext();
    });
  };
  await loseContext();
  await expect(page.getByRole("status")).toContainText("Waiting for recovery");
  await expect(
    page.getByRole("heading", { name: "Discover places" }),
  ).toBeVisible();
  await page.evaluate(() => (window as any).restoreMapContext());
  await expect(
    page.getByText("Waiting for recovery", { exact: false }),
  ).toHaveCount(0);
  await loseContext();
  await expect(
    page.getByRole("button", { name: "Retry map", exact: true }),
  ).toBeVisible();
  const oldCanvas = await canvas.elementHandle();
  await page.getByRole("button", { name: "Retry map", exact: true }).click();
  await expect(canvas).toBeVisible();
  expect(await oldCanvas!.evaluate((element) => element.isConnected)).toBe(
    false,
  );
  await expect(canvas).toHaveCount(1);
  await expect(page.getByLabel("Interactive world map")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(
    page.getByRole("heading", { name: "Discover places" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry map", exact: true }),
  ).toHaveCount(0);
});
