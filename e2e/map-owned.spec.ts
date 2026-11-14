import { expect, test } from "@playwright/test";

test("personal map objects and profile checkboxes load before thumbnails", async ({
  page,
}) => {
  let releaseImages!: () => void;
  const imagesGate = new Promise<void>((resolve) => {
    releaseImages = resolve;
  });
  const personal = {
    id: "personal",
    userId: "owner",
    type: "USER",
    firstName: "Marcus",
    locationPlaceId: "rome",
    location: "Rome",
  };
  const persona = {
    id: "persona",
    userId: "owner",
    type: "CLUB",
    firstName: "Lucius",
    locationPlaceId: "rome",
    location: "Rome",
  };
  const place = {
    id: "rome",
    canonicalName: "Rome",
    latitude: 41.9,
    longitude: 12.5,
    featureType: "CITY",
  };
  const markers = [
    {
      entityType: "PROFILE",
      entityId: "persona",
      locationRole: "CLUB_ASSOCIATION",
      label: "Lucius",
    },
    {
      entityType: "CLUB",
      entityId: "club",
      locationRole: "CLUB_ASSOCIATION",
      label: "Legion",
    },
    {
      entityType: "SOURCE",
      entityId: "source",
      locationRole: "DISCOVERED_AT",
      label: "Roman source",
    },
  ].map((marker) => ({
    ...marker,
    placeId: "rome",
    placeName: "Rome",
    latitude: 41.9,
    longitude: 12.5,
  }));
  let projectionRequests = 0;
  await page.route("**/map-test-avatar.svg*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#4f6d7a"/></svg>',
    }),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/user/me")
      return route.fulfill({ json: { userId: "owner", roles: [] } });
    if (path === "/api/profile/user-profile")
      return route.fulfill({ json: personal });
    if (path === "/api/profile/club-profile")
      return route.fulfill({ json: [persona] });
    if (path === "/api/map/projections") {
      projectionRequests++;
      return route.fulfill({
        json: {
          items: [
            { scope: "PROFILE", id: "persona", markers, connections: [] },
          ],
        },
      });
    }
    if (path === "/api/map/places")
      return route.fulfill({ json: { items: [place] } });
    if (path === "/api/profile/profiles")
      return route.fulfill({ json: [personal, persona] });
    if (path === "/api/images/lookup") {
      await imagesGate;
      return route.fulfill({
        json: {
          content: request.postDataJSON().resources.map((resource: any) => ({
            ...resource,
            image: {
              id: `image-${resource.resourceId}`,
              thumbnailUrl: `/map-test-avatar.svg?id=${resource.resourceId}`,
            },
          })),
        },
      });
    }
    if (path.startsWith("/api/images/profile/"))
      return route.fulfill({ json: { content: [] } });
    return route.fulfill({ status: 401, json: {} });
  });
  try {
    await page.goto("/map");
    await expect(
      page.getByRole("checkbox", { name: "User profile: Marcus" }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "Reenactment profile: Lucius" }),
    ).toBeChecked();
    await expect(page.locator(".map-owned-marker")).toHaveCount(4);
    await expect(page.locator(".map-owned-marker img")).toHaveCount(0);
    await expect(page).toHaveURL(/scope=USER&scopeId=owner/);
    expect(projectionRequests).toBe(1);
    releaseImages();
    await expect(page.locator(".map-owned-marker img")).toHaveCount(4);
    await expect(page.locator(".map-owned-marker")).toHaveCount(4);
    await expect(
      page.getByRole("checkbox", { name: "Reenactment profile: Lucius" }),
    ).toBeChecked();
    await page
      .getByRole("checkbox", { name: "Reenactment profile: Lucius" })
      .uncheck();
    await expect(page.locator(".map-owned-marker")).toHaveCount(3);
    expect(projectionRequests).toBe(1);
  } finally {
    releaseImages();
  }
});
