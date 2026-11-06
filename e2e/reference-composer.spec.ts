import { expect, test } from "@playwright/test";
import path from "path";
import fs from "fs";
import webpack from "webpack";

// Bundle the real component into a test-only page; no production test route.
let bundle: string;
test.beforeAll(async () => {
  const outputPath = path.resolve("node_modules/.cache/composer-e2e", String(process.pid));
  await new Promise<void>((resolve, reject) =>
    webpack(
      {
        mode: "development",
        entry: path.resolve("e2e/fixtures/reference-composer.tsx"),
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
            { test: /\.(png|svg)$/, type: "asset/inline" },
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
test.beforeEach(async ({ page }) => {
  await page.route(/\/composer-fixture(\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<div id="root"></div><script src="/composer-fixture.js"></script>',
    }),
  );
  await page.route("**/composer-fixture.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: bundle }),
  );
  await page.route("**/api/**", (route) => {
    const url = route.request().url();
    let body: unknown = { content: [], hasMore: false };
    if (url.includes("/profile/search"))
      body = [
        {
          id: "00000000-0000-4000-8000-000000000001",
          firstName: "Alex",
          lastName: "Archer",
        },
      ];
    if (url.includes("/images/"))
      body = { content: [{ thumbnailUrl: "/avatar.svg" }] };
    return route.fulfill({ json: body });
  });
  await page.route("**/avatar.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="16" fill="blue"/></svg>',
    }),
  );
  await page.goto("/composer-fixture");
});

test("public composer keeps spaces, caret, inline references and persisted ranges intact", async ({
  page,
}, testInfo) => {
  const editor = page.getByRole("textbox");
  await editor.fill("Hello ");
  await editor.press("End");
  await editor.pressSequentially("@Alex");
  await page.getByRole("option", { name: /Alex Archer/ }).click();
  const link = editor.getByRole("link", { name: "@Alex Archer" });
  await expect(link).toBeVisible();
  await page.keyboard.type("and welcome");
  await expect(page.getByTestId("document")).toContainText(
    '"value":"Hello @Alex Archer and welcome"',
  );
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("Second line");
  await link.hover();
  await expect(page.getByRole("tooltip").locator("img")).toHaveAttribute(
    "src",
    "/avatar.svg",
  );
  await expect(link).toHaveAttribute("href", /\/profile\/00000000/);
  await page.screenshot({ path: testInfo.outputPath("composer-preview.png") });
  // Clicking and pressing spaces must never introduce a newline.
  await editor.click({ position: { x: 8, y: 10 } });
  await editor.press("Control+End");
  await editor.press("Space");
  await page.keyboard.type("end");
  const document = JSON.parse(
    (await page.getByTestId("document").textContent())!,
  );
  expect(document.value).toBe(
    "Hello @Alex Archer and welcome\nSecond line end",
  );
  expect(document.references).toMatchObject([
    { start: 6, end: 18, name: "Alex Archer" },
  ]);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(editor).toHaveText("");
  await page.getByRole("link", { name: "@Alex Archer" }).hover();
  await expect(page.getByRole("tooltip").locator("img")).toHaveAttribute(
    "src",
    "/avatar.svg",
  );
  await page.getByRole("button", { name: "Edit saved" }).click();
  await expect(
    editor.getByRole("link", { name: "@Alex Archer" }),
  ).toBeVisible();
  await editor.press("Control+End");
  await page.keyboard.type(" again");
  await expect(page.getByTestId("document")).toContainText(
    "Second line end again",
  );
});

test("public composer supports keyboard reference selection, deletion, undo and paste", async ({
  page,
}) => {
  const editor = page.getByRole("textbox");
  await editor.fill("@Alex");
  await expect(page.getByRole("option", { name: /Alex Archer/ })).toBeVisible();
  await editor.press("Enter");
  await expect(editor.getByRole("link")).toBeVisible();
  await page.keyboard.type("hello");
  await editor.press("Control+z");
  await editor.press("Control+Shift+z");
  await expect(page.getByTestId("document")).toContainText("hello");
  await editor.press("Control+a");
  const clipboard = await editor.evaluate((node) => {
    const data = new DataTransfer();
    node.dispatchEvent(
      new ClipboardEvent("copy", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
    return Object.fromEntries(
      [...data.types].map((type) => [type, data.getData(type)]),
    );
  });
  await editor.press("Control+End");
  await editor.evaluate((node, entries) => {
    const data = new DataTransfer();
    Object.entries(entries).forEach(([type, text]) => data.setData(type, text));
    node.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  }, clipboard);
  await expect
    .poll(
      async () =>
        JSON.parse((await page.getByTestId("document").textContent())!)
          .references.length,
    )
    .toBe(2);
  await editor.press("Control+a");
  await editor.press("Backspace");
  await expect(editor).toHaveText("");
  await expect(page.getByTestId("document")).toHaveText(
    '{"value":"","references":[]}',
  );
  await editor.evaluate((node) => {
    const data = new DataTransfer();
    data.setData("text/plain", "Pasted text\nwith spaces");
    node.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  });
  await expect(page.getByTestId("document")).toContainText(
    "Pasted text\\nwith spaces",
  );
});

test("public chat composer selects a reference with Enter before sending and limits length", async ({
  page,
}) => {
  await page.goto("/composer-fixture?chat");
  const editor = page.getByRole("textbox");
  await editor.fill("@Alex");
  await expect(page.getByRole("option", { name: /Alex Archer/ })).toBeVisible();
  await editor.press("Enter");
  await expect(editor.getByRole("link")).toBeVisible();
  await page.keyboard.type("welcome");
  await editor.press("Shift+Enter");
  await page.keyboard.type("next line");
  await editor.press("Enter");
  await expect(editor).toHaveText("");
  await expect(page.getByRole("link", { name: "@Alex Archer" })).toBeVisible();
  await page.getByRole("button", { name: "Edit saved" }).click();
  await expect(page.getByTestId("document")).toContainText(
    "@Alex Archer welcome\\nnext line",
  );
  await editor.fill("x".repeat(2000));
  await editor.press("End");
  await page.keyboard.type("z");
  await expect(page.getByTestId("document")).not.toContainText("z");
});

test("public older profile, club, event and source references resolve missing thumbnails", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Load older references" }).click();
  for (let index = 0; index < 4; index++) {
    await page.getByRole("link", { name: `@Object ${index}` }).hover();
    await expect(page.getByRole("tooltip").locator("img")).toHaveAttribute(
      "src",
      "/avatar.svg",
    );
  }
});
