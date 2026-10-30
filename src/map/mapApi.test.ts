import {
  getMapPlaces,
  listMapPlaceEntities,
  nearbyMapEntitiesPage,
} from "./mapApi";

test("coalesces concurrent place reads into one bounded batch request", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    text: async () =>
      JSON.stringify({
        items: [
          { id: "batch-a", canonicalName: "A", latitude: 1, longitude: 1, featureType: "SETTLEMENT" },
          { id: "batch-b", canonicalName: "B", latitude: 2, longitude: 2, featureType: "SETTLEMENT" },
          { id: "batch-c", canonicalName: "C", latitude: 3, longitude: 3, featureType: "SETTLEMENT" },
        ],
      }),
  } as Response);

  await expect(
    Promise.all([
      getMapPlaces(["batch-a", "batch-b"]),
      getMapPlaces(["batch-b", "batch-c"]),
    ]),
  ).resolves.toEqual([
    [expect.objectContaining({ id: "batch-a" }), expect.objectContaining({ id: "batch-b" })],
    [expect.objectContaining({ id: "batch-b" }), expect.objectContaining({ id: "batch-c" })],
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/map/places?ids=batch-a%2Cbatch-b%2Cbatch-c",
  );
  fetchMock.mockRestore();
});

test("falls back only for a legacy place id resolved by a merge", async () => {
  const fetchMock = jest
    .spyOn(global, "fetch")
    .mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ items: [] }),
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "seed:canonical-rome",
          canonicalName: "Rome",
          latitude: 41.9,
          longitude: 12.5,
          featureType: "SETTLEMENT",
        }),
    } as Response);

  await expect(getMapPlaces(["seed:merged-rome"])).resolves.toEqual([
    expect.objectContaining({ id: "seed:canonical-rome" }),
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/map/places/seed%3Amerged-rome",
    { signal: undefined },
  );
  fetchMock.mockRestore();
});

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
