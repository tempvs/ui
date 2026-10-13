import { listMapPlaceEntities, nearbyMapEntitiesPage } from "./mapApi";

test("sends exact-place role refinements as a bounded query parameter", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({ items: [] }),
  } as Response);

  await listMapPlaceEntities(
    "seed:rome",
    ["SOURCE"],
    ["DISCOVERED_AT"],
  );

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("types=SOURCE&roles=DISCOVERED_AT"),
    expect.objectContaining({ signal: undefined }),
  );
  fetchMock.mockRestore();
});

test("preserves an opaque nearby-marker cursor without requesting full entities", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    text: async () =>
      JSON.stringify({
        items: [
          {
            entityType: "PROFILE",
            entityId: "profile-1",
            locationRole: "CURRENT_RESIDENCE",
            label: "Profile",
            placeId: "seed:rome",
            placeName: "Rome",
            latitude: 41.9,
            longitude: 12.5,
          },
        ],
        nextCursor: "opaque-next-page",
      }),
  } as Response);

  await expect(
    nearbyMapEntitiesPage(
      41.9,
      12.5,
      25,
      ["PROFILE"],
      undefined,
      undefined,
      [],
      {},
      {},
      undefined,
      "opaque-current-page",
    ),
  ).resolves.toEqual(
    expect.objectContaining({
      nextCursor: "opaque-next-page",
      items: [expect.objectContaining({ entityId: "profile-1" })],
    }),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("cursor=opaque-current-page"),
    expect.objectContaining({ signal: undefined }),
  );
  fetchMock.mockRestore();
});
