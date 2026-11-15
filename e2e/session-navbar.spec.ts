import { expect, test } from "@playwright/test";

for (const trigger of ["API failure", "navigation", "focus"] as const) {
  test(`public navbar fixture clears an expired Google session on ${trigger}`, async ({
    page,
  }) => {
    let active = true;
    await page.route("**/session-avatar.svg", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#4f6d7a"/></svg>',
      }),
    );
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/user/me")
        return route.fulfill({
          status: active ? 200 : 401,
          json: active
            ? {
                userId: "member",
                name: "Ada",
                picture: "/session-avatar.svg",
                roles: [],
              }
            : {},
        });
      if (path === "/api/profile/user-profile")
        return route.fulfill({
          json: {
            id: "personal",
            userId: "member",
            type: "USER",
            firstName: "Ada",
          },
        });
      if (path === "/api/profile/club-profile")
        return route.fulfill({ json: [] });
      if (path === "/api/profile/profile/onboarding-status")
        return route.fulfill({
          json: {
            personaCount: 1,
            itemCount: 1,
            sourcedItemCount: 1,
            connectionCount: 1,
            partial: false,
          },
        });
      if (path === "/api/notification/unread-count")
        return route.fulfill({
          status: active ? 200 : 401,
          json: { count: 0 },
        });
      return route.fulfill({ json: { content: [], count: 0, hasMore: false } });
    });
    await page.goto("/clubs");
    const account = page.getByRole("button", {
      name: "Account menu",
      exact: true,
    });
    await expect(account.locator("img")).toHaveAttribute(
      "src",
      "/session-avatar.svg",
    );
    active = false;
    if (trigger === "API failure") {
      // Exercise the same browser transport used by background count polling.
      await page.evaluate(() =>
        fetch("/api/notification/unread-count").then(() => undefined),
      );
    } else if (trigger === "navigation") {
      await page.getByRole("link", { name: "Map", exact: true }).click();
    } else {
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    }
    await expect(
      page.getByRole("button", { name: "Log in", exact: true }),
    ).toBeVisible();
    await expect(account).toHaveCount(0);
    await expect(page.locator("img.auth-avatar-image")).toHaveCount(0);
    await expect(
      page.getByRole("combobox", { name: "Current profile" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Chat", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Notifications", exact: true }),
    ).toHaveCount(0);
  });
}
