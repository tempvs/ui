import { expect, test } from "@playwright/test";

test("wall follows server checkpoints without browser collection discovery", async ({
  page,
}) => {
  const requests: URL[] = [];
  const forbidden: string[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/user/me")
      return route.fulfill({ json: { userId: "owner", roles: [] } });
    if (url.pathname === "/api/profile/user-profile")
      return route.fulfill({
        json: {
          id: "profile",
          userId: "owner",
          type: "USER",
          firstName: "Marcus",
        },
      });
    if (url.pathname === "/api/profile/club-profile")
      return route.fulfill({ json: [] });
    if (url.pathname === "/api/profile/profile/onboarding-preferences")
      return route.fulfill({
        json: { dismissedAt: "2026-11-15T00:00:00Z", celebratedAt: null },
      });
    if (url.pathname === "/api/profile/profile/onboarding-status")
      return route.fulfill({
        json: {
          personaCount: 1,
          itemCount: 1,
          sourcedItemCount: 1,
          connectionCount: 1,
          partial: false,
          computedAt: "2026-11-15T00:00:00Z",
        },
      });
    if (url.pathname === "/api/wall") {
      requests.push(url);
      if (!url.searchParams.has("nextToken"))
        return route.fulfill({
          json: {
            content: [],
            hasMore: true,
            nextToken: "s1.discovery",
            preparing: true,
          },
        });
      if (url.searchParams.get("nextToken") === "s1.discovery")
        return route.fulfill({
          json: {
            content: [
              {
                id: "late-target",
                eventType: "profile.updated.v1",
                occurredAt: "2026-11-15T00:00:00Z",
                producer: "profile",
                targetType: "PROFILE",
                targetId: "beyond-60",
                title: "Update beyond sixty targets",
                path: "/profile/beyond-60",
              },
            ],
            hasMore: true,
            nextToken: "s1.older",
          },
        });
      return route.fulfill({ json: { content: [], hasMore: false } });
    }
    if (
      url.pathname.startsWith("/api/stash/") ||
      url.pathname.endsWith("/following") ||
      url.pathname.endsWith("/followed-clubs")
    )
      forbidden.push(url.pathname);
    if (url.pathname === "/api/images/lookup")
      return route.fulfill({ json: { content: [] } });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/");
  await expect(page.getByText("Update beyond sixty targets")).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(
    requests.every(
      (url) =>
        url.searchParams.get("discovery") === "server" &&
        !url.searchParams.has("target"),
    ),
  ).toBe(true);
  expect(forbidden).toEqual([]);
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Load more", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Update beyond sixty targets")).toBeVisible();
});

test("search code loads on interaction and preserves typing while its chunk is pending", async ({
  page,
}) => {
  const chunks: string[] = [];
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/SearchDialog-*.js", async (route) => {
    chunks.push(route.request().url());
    await pending;
    return route.continue();
  });
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  try {
    await page.goto("/");
    const search = page.getByRole("searchbox", {
      name: "Search profiles, clubs, events, and sources",
    });
    await expect(search).toBeVisible();
    expect(chunks).toEqual([]);
    await search.fill("roman");
    await expect(search).toHaveValue("roman");
    release();
    await expect(
      page.getByRole("dialog", { name: "Search", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("searchbox", {
        name: "Search profiles, clubs, events, and sources",
      }),
    ).toHaveValue("roman");
    expect(chunks).toHaveLength(1);
  } finally {
    release();
  }
});
