import { expect, test, type Locator } from "@playwright/test";
import type { PendingSourceChangeset, SourceChangesetStatus } from "../src/library/libraryApi";
import { buildFixture } from "./support/buildFixture";

const submitted = "2026-11-08T12:00:00Z";
const viewer = "reviewer";

async function activate(button: Locator) {
  await expect(button).toBeEnabled();
  await button.press("Enter");
}

function proposal(id: string, name: string, proposerId: string, status: SourceChangesetStatus): PendingSourceChangeset {
  const base = {
    name,
    description: "Published description",
    period: "MODERN" as const,
    type: "WRITTEN" as const,
    from: null,
    to: null,
  };
  return {
    source: { ...base, id, version: 1 },
    changeset: {
      id: `revision-${id}`,
      sourceId: id,
      proposerId,
      kind: "UPDATE",
      status,
      base,
      proposed: { ...base, description: "Proposed description" },
      version: 2,
      baseVersion: 1,
      revision: 1,
      imageOperations: [],
      createdAt: submitted,
      updatedAt: submitted,
    },
  };
}

let bundle: string;
test.beforeAll(async () => {
  bundle = await buildFixture("library-journey");
});

test("reviews, revises, approves and publishes proposals in the queue", async ({ page }) => {
  const rows = [
    proposal("charter", "Market charter", "author", "APPROVED"),
    proposal("register", "Guild register", "author", "PENDING"),
    proposal("map", "Town map", viewer, "APPROVED"),
  ];
  let saves = 0;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/library/proposals", (route) => route.fulfill({
    contentType: "text/html",
    body: '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script src="/proposal-workspace-fixture.js"></script>',
  }));
  await page.route("**/proposal-workspace-fixture.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: bundle }),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/user/me") {
      return route.fulfill({ json: { userId: viewer, roles: ["LIBRARY_SCRIBE"] } });
    }
    if (url.pathname === "/api/library/library/admin/changesets") {
      return route.fulfill({
        json: { content: rows.filter(({ changeset }) => changeset.status !== "APPLIED") },
      });
    }
    if (url.pathname === "/api/library/library/onboarding") {
      return route.fulfill({ json: { learned: [], dismissedHints: [], hiddenAudiences: [] } });
    }
    const detail = url.pathname.match(/^\/api\/library\/source\/([^/]+)\/changesets\/([^/]+)(?:\/(approve|publish))?$/);
    const row = detail && rows.find(({ changeset }) => changeset.id === detail[2]);
    if (!row) return route.fulfill({ json: { content: [] } });
    if (request.method() === "GET") return route.fulfill({ json: row });
    expect(request.headers()["if-match"]).toBe(`"${row.changeset.version}"`);
    if (request.method() === "PATCH") {
      saves += 1;
      row.changeset = {
        ...row.changeset,
        ...request.postDataJSON(),
        status: "PENDING",
        version: 3,
        revision: 2,
        amendments: [{ userId: viewer, revision: 2, amendedAt: submitted }],
      };
      return route.fulfill({ json: row.changeset });
    }
    row.changeset = {
      ...row.changeset,
      status: detail[3] === "approve" ? "APPROVED" : "APPLIED",
      version: row.changeset.version + 1,
    };
    return route.fulfill({ json: row });
  });

  await page.goto("/library/proposals");
  const mobile = page.viewportSize()!.width < 992;
  const queue = page.getByRole("region", { name: "Proposals", exact: true });
  const review = page.getByRole("region", { name: "Proposal review" });
  const filter = page.getByRole("combobox", { name: "Filter pending proposals by source type" });
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/library/library/admin/changesets" && url.searchParams.get("type") === "WRITTEN";
    }),
    filter.selectOption("WRITTEN"),
  ]);
  await expect(queue).toHaveAttribute("aria-busy", "false");
  const charter = queue.getByRole("button", { name: /Market charter/ });
  await activate(charter);
  await expect(review.getByRole("heading", { name: "Market charter" })).toBeVisible();
  if (mobile) await expect(queue).toBeHidden();
  else {
    await expect(queue).toBeVisible();
    expect((await queue.boundingBox())!.x).toBeLessThan((await review.boundingBox())!.x);
  }
  await activate(review.getByRole("button", { name: "Edit proposal" }));
  await expect(review.getByText("Saving this revision requires a new approval.")).toBeVisible();
  await review.getByRole("textbox", { name: "Description", exact: true }).fill("Revised charter description");
  await activate(review.getByRole("button", { name: "Save revision" }));
  await expect(review.getByText("Revision saved and awaiting independent review.")).toBeVisible();
  await expect(review.getByText("Revised charter description")).toBeVisible();
  await expect(review.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  expect(saves).toBe(1);
  await expect(page).toHaveURL(/\/library\/proposals$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);

  if (mobile) {
    await activate(review.getByRole("button", { name: /Back to proposals/ }));
    await expect(charter).toBeFocused();
  }
  await expect(filter).toHaveValue("WRITTEN");
  await activate(queue.getByRole("button", { name: /Guild register/ }));
  await activate(review.getByRole("button", { name: "Approve", exact: true }));
  await expect(review.getByText("Approved — ready to publish", { exact: true })).toBeVisible();
  await expect(review.getByRole("button", { name: "Publish", exact: true })).toHaveCount(0);

  if (mobile) await activate(review.getByRole("button", { name: /Back to proposals/ }));
  await activate(queue.getByRole("button", { name: /Town map/ }));
  await activate(review.getByRole("button", { name: "Publish", exact: true }));
  await expect(review.getByText("Proposal published to the Library.")).toBeVisible();
  await expect(page).toHaveURL(/\/library\/proposals$/);
  if (mobile) await activate(review.getByRole("button", { name: /Back to proposals/ }));
  await expect(queue.getByRole("button", { name: /Town map/ })).toHaveCount(0);
});
