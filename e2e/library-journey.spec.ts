import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";
import webpack from "webpack";

let bundle: string;
test.beforeAll(async () => {
  const outputPath = path.resolve(
    "node_modules/.cache/library-journey-e2e",
    String(process.pid),
  );
  await new Promise<void>((resolve, reject) =>
    webpack(
      {
        mode: "development",
        entry: path.resolve("e2e/fixtures/library-journey.tsx"),
        output: { path: outputPath, filename: "fixture.js" },
        resolve: { extensions: [".tsx", ".ts", ".js", ".mjs"] },
        module: {
          rules: [
            {
              test: /\.tsx?$/,
              exclude: /node_modules/,
              use: {
                loader: "babel-loader",
                options: {
                  presets: [
                    ["@babel/preset-env", { targets: { chrome: "120" } }],
                    ["@babel/preset-react", { runtime: "automatic" }],
                    "@babel/preset-typescript",
                  ],
                },
              },
            },
            { test: /\.css$/, use: ["style-loader", "css-loader"] },
            { test: /\.(png|jpe?g|svg)$/, type: "asset/inline" },
          ],
        },
      },
      (error, stats) =>
        error || stats?.hasErrors()
          ? reject(
              error || new Error(stats?.toString({ all: false, errors: true })),
            )
          : resolve(),
    ),
  );
  bundle = fs.readFileSync(path.join(outputPath, "fixture.js"), "utf8");
});

test("public Library guide fixture keeps plus hints visible, dismissible, and account progress cached", async ({
  page,
}, testInfo) => {
  const progress = {
    learned: [
      "browse",
      "source",
      "workflow",
      "status",
      "review",
      "tasks",
      "publish",
    ],
    dismissedHints: [] as string[],
    hiddenAudiences: [] as string[],
  };
  let reads = 0;
  let writes = 0;
  await page.route("**/library", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script src="/library-fixture.js"></script>',
    }),
  );
  await page.route("**/library-fixture.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: bundle }),
  );
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = { content: [] };
    if (url.pathname === "/api/user/me")
      body = { userId: "library-learner", roles: ["LIBRARY_SCRIBE"] };
    else if (url.pathname === "/api/library/library")
      body = { roleRequests: [] };
    else if (url.pathname === "/api/library/library/onboarding") {
      if (route.request().method() === "PATCH") {
        writes++;
        const delta = route.request().postDataJSON();
        progress.learned = Array.from(
          new Set([...progress.learned, ...(delta.learned || [])]),
        );
        progress.dismissedHints = Array.from(
          new Set([
            ...progress.dismissedHints,
            ...(delta.dismissedHints || []),
          ]),
        );
      } else reads++;
      body = progress;
    }
    await route.fulfill({ json: body });
  });
  await page.goto("/library");
  await expect(page.getByText("7 of 8 topics learned")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("library-guide.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.locator('a[href="/library/period/ancient"]').click();
  const plus = page.getByRole("button", { name: "Create source", exact: true });
  await expect(plus).toBeVisible();
  // A pulsing target deliberately never meets Playwright's stable-element check.
  await plus.evaluate((button) => button.scrollIntoView({ block: "center" }));
  const hint = page.locator(".dismissible-coachmark");
  await expect(hint).toHaveCount(1);
  await expect(hint).toContainText("Use + to propose a source");
  await expect(
    plus.locator(
      "xpath=ancestor::span[contains(@class,'coachmark-anchor')][1]",
    ),
  ).toHaveClass(/coachmark-anchor--visible/);
  expect(
    await plus.evaluate((button) => getComputedStyle(button).animationName),
  ).toBe("coachmark-attention-pulse");
  const pulse = await plus.evaluate((button) => {
    const tooltip = document.querySelector(".dismissible-coachmark")!;
    const frame = tooltip.querySelector(".dismissible-coachmark-frame")!;
    const message = tooltip.querySelector(".dismissible-coachmark-message")!;
    const close = tooltip.querySelector("button")!;
    const buttonAnimation = button.getAnimations()[0];
    const frameAnimation = frame.getAnimations()[0];
    const startDifference = Math.abs(
      Number(buttonAnimation.startTime) - Number(frameAnimation.startTime),
    );
    const duration = Number(buttonAnimation.effect!.getTiming().duration);
    buttonAnimation.pause();
    frameAnimation.pause();
    const samples = [0, duration / 2].map((time) => {
      buttonAnimation.currentTime = time;
      frameAnimation.currentTime = time;
      return {
        buttonScale: new DOMMatrix(getComputedStyle(button).transform).a,
        frameScale: new DOMMatrix(getComputedStyle(frame).transform).a,
        message: message.getBoundingClientRect().toJSON(),
        close: close.getBoundingClientRect().toJSON(),
        frame: frame.getBoundingClientRect().toJSON(),
      };
    });
    return { startDifference, samples };
  });
  expect(pulse.startDifference).toBeLessThan(1);
  expect(pulse.samples[0].buttonScale).toBeLessThan(
    pulse.samples[1].buttonScale,
  );
  expect(pulse.samples[0].frameScale).toBeGreaterThan(
    pulse.samples[1].frameScale,
  );
  expect(pulse.samples[0].message).toEqual(pulse.samples[1].message);
  expect(pulse.samples[0].close).toEqual(pulse.samples[1].close);
  for (const sample of pulse.samples) {
    expect(sample.frame.left).toBeGreaterThanOrEqual(0);
    expect(sample.frame.right).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  const box = await hint.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({
    path: testInfo.outputPath("library-plus-hint.png"),
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await hint
      .locator(".dismissible-coachmark-frame")
      .evaluate((frame) => getComputedStyle(frame).animationName),
  ).toBe("none");
  expect(
    await plus.evaluate((button) => getComputedStyle(button).animationName),
  ).toBe("none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect
    .poll(() =>
      hint
        .locator(".dismissible-coachmark-frame")
        .evaluate((frame) => getComputedStyle(frame).animationName),
    )
    .toBe("coachmark-frame-pulse");
  await page.getByRole("button", { name: "Dismiss hint" }).click();
  await expect(hint).toHaveCount(0);
  expect(
    await plus.evaluate((button) => getComputedStyle(button).animationName),
  ).toBe("none");
  await expect.poll(() => writes).toBe(1);
  await page
    .getByRole("link", { name: "Library", exact: true })
    .first()
    .click();
  await expect(page.getByText("7 of 8 topics learned")).toBeVisible();
  expect(reads).toBe(1);
  expect(progress.dismissedHints).toContain("proposal");
});
