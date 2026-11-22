import { expect, test } from "@playwright/test";
import { buildFixture } from "./support/buildFixture";

let bundle: string;
test.beforeAll(async () => {
  bundle = await buildFixture("library-journey");
});

test("period counter follows the review queue through empty filtered pages and publication", async ({
  page,
}) => {
  let published = false;
  const tokens: Array<string | null> = [];
  let legacyProposalReads = 0;
  await page.route("**/library/period/modern", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script src="/proposal-count-fixture.js"></script>',
    }),
  );
  await page.route("**/proposal-count-fixture.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: bundle }),
  );
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/user/me")
      return route.fulfill({
        json: { userId: "counter-fixture", roles: ["LIBRARY_SCRIBE"] },
      });
    if (url.pathname.endsWith("/proposals")) legacyProposalReads++;
    if (url.pathname === "/api/library/library/admin/changesets") {
      expect(url.searchParams.get("period")).toBe("MODERN");
      expect(Number(url.searchParams.get("limit"))).toBeLessThanOrEqual(40);
      const token = url.searchParams.get("nextToken");
      tokens.push(token);
      if (!token)
        return route.fulfill({
          json: {
            content: [
              { changeset: { kind: "CREATE", status: "PENDING" } },
              { changeset: { kind: "UPDATE", status: "PENDING" } },
            ],
            nextToken: "empty-filtered-page",
          },
        });
      if (token === "empty-filtered-page")
        return route.fulfill({ json: { content: [], nextToken: "last-page" } });
      return route.fulfill({
        json: {
          content: published
            ? []
            : [{ changeset: { kind: "DELETE", status: "APPROVED" } }],
          nextToken: null,
        },
      });
    }
    if (url.pathname === "/api/library/library/onboarding")
      return route.fulfill({
        json: { learned: [], dismissedHints: [], hiddenAudiences: [] },
      });
    return route.fulfill({ json: { content: [] } });
  });
  await page.goto("/library/period/modern");
  await expect(
    page.getByRole("link", { name: "Pending proposals (3)", exact: true }),
  ).toBeVisible();
  expect(tokens).toEqual([null, "empty-filtered-page", "last-page"]);
  expect(legacyProposalReads).toBe(0);
  published = true;
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Pending proposals (2)", exact: true }),
  ).toBeVisible();
  expect(legacyProposalReads).toBe(0);
});
