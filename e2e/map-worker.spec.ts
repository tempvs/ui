import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: {} }));
});

test("public map loads its matching worker only after opening the map", async ({ page }) => {
  const workers: Array<{ url: string; status: number; contentType: string }> = [];
  page.on("response", (response) => {
    if (/\/static\/maplibre-gl-worker-[\w-]+\.js$/.test(response.url())) {
      workers.push({
        url: response.url(), status: response.status(),
        contentType: response.headers()["content-type"] || "",
      });
    }
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Tempvs/ }).first()).toBeVisible();
  expect(workers).toHaveLength(0);
  await page.goto("/map");
  await expect(page.getByLabel("Interactive world map")).toHaveAttribute("aria-busy", "false");
  expect(workers.length).toBeGreaterThan(0);
  for (const worker of workers) {
    expect(new URL(worker.url).origin).toBe(new URL(page.url()).origin);
    expect(worker.status).toBe(200);
    expect(worker.contentType).toMatch(/javascript/);
  }
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
});

test("public map explains the WebGL2 requirement even when WebGL1 is available", async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    (window as any).allowMapWebgl2 = false;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement, type: string, ...args: any[]
    ) {
      if (type === "webgl2" && !(window as any).allowMapWebgl2) return null;
      return (getContext as any).call(this, type, ...args);
    } as typeof getContext;
  });
  await page.goto("/map");
  const alert = page.getByRole("region", { name: "Interactive map", exact: true }).getByRole("alert");
  await expect(alert).toContainText("WebGL2");
  await expect(page.getByRole("heading", { name: "Discover places" })).toBeVisible();
  expect(await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl");
    const available = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return available;
  })).toBe(true);
  await page.getByRole("combobox", { name: "Place", exact: true }).fill("Rome");
  await page.evaluate(() => { (window as any).allowMapWebgl2 = true; });
  await page.getByRole("button", { name: "Retry map", exact: true }).click();
  await expect(alert).toHaveCount(0);
  await expect(page.getByLabel("Interactive world map")).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("combobox", { name: "Place", exact: true })).toHaveValue("Rome");
});
