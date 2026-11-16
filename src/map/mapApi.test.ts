import {
  getMapPlaces,
  getMapPlace,
  listMyMapSnapshots,
  getMapProjections,
  listMapPlaceEntities,
  mapPlaceReference,
  nearbyMapEntitiesPage,
} from "./mapApi";

test("loads every projection beyond 40 IDs in bounded cancellable batches", async () => {
  const controller = new AbortController();
  const fetchMock = jest
    .spyOn(global, "fetch")
    .mockImplementation(async (input, options) => {
      expect(options?.signal).toBe(controller.signal);
      const ids = new URL(String(input), "https://test.local").searchParams
        .get("ids")!
        .split(",");
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            items: ids.map((id) => ({
              id,
              scope: "PROFILE",
              markers: [],
              connections: [],
            })),
          }),
      } as Response;
    });
  try {
    const projections = await getMapProjections(
      "PROFILE",
      Array.from({ length: 91 }, (_, i) => String(i)),
      controller.signal,
    );
    expect(projections).toHaveLength(91);
    expect(
      fetchMock.mock.calls.map(
        ([url]) =>
          new URL(String(url), "https://test.local").searchParams
            .get("ids")!
            .split(",").length,
      ),
    ).toEqual([40, 40, 11]);
  } finally {
    fetchMock.mockRestore();
  }
});

test("cancels abandoned place transports while preserving another consumer", async () => {
  let finish!: (value: Response) => void;
  let signal!: AbortSignal;
  const fetchMock = jest
    .spyOn(global, "fetch")
    .mockImplementation((_url, options) => {
      signal = options!.signal as AbortSignal;
      return new Promise<Response>((resolve, reject) => {
        finish = resolve;
        signal.addEventListener("abort", () => reject(signal.reason));
      });
    });
  try {
    const a = new AbortController(),
      b = new AbortController();
    const first = getMapPlaces(["shared-cancel-place"], a.signal);
    const rejection = expect(first).rejects.toMatchObject({
      name: "AbortError",
    });
    const second = getMapPlaces(["shared-cancel-place"], b.signal);
    await Promise.resolve();
    a.abort();
    await rejection;
    expect(signal.aborted).toBe(false);
    finish({
      ok: true,
      text: async () =>
        JSON.stringify({ items: [{ id: "shared-cancel-place" }] }),
    } as Response);
    await expect(second).resolves.toHaveLength(1);
    const c = new AbortController();
    const last = getMapPlaces(["abandoned-place"], c.signal);
    const lastRejection = expect(last).rejects.toMatchObject({
      name: "AbortError",
    });
    await Promise.resolve();
    c.abort();
    await lastRejection;
    expect(signal.aborted).toBe(true);
  } finally {
    fetchMock.mockRestore();
  }
});

test("preserves explicit truncation on nearby result pages", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({ items: [], truncated: true }),
  } as Response);
  await expect(
    nearbyMapEntitiesPage(41, 12, 25, ["SOURCE"]),
  ).resolves.toMatchObject({ truncated: true });
  fetchMock.mockRestore();
});

test("prefers a stable UUID over a legacy place id for shareable references", () => {
  expect(
    mapPlaceReference({
      id: "seed:pleiades-places:109169",
      publicId: "c56ec465-333c-40cd-bf7f-727419dced3a",
    }),
  ).toBe("c56ec465-333c-40cd-bf7f-727419dced3a");
});

test("coalesces concurrent place reads into one bounded batch request", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    text: async () =>
      JSON.stringify({
        items: [
          {
            id: "batch-a",
            canonicalName: "A",
            latitude: 1,
            longitude: 1,
            featureType: "SETTLEMENT",
          },
          {
            id: "batch-b",
            canonicalName: "B",
            latitude: 2,
            longitude: 2,
            featureType: "SETTLEMENT",
          },
          {
            id: "batch-c",
            canonicalName: "C",
            latitude: 3,
            longitude: 3,
            featureType: "SETTLEMENT",
          },
        ],
      }),
  } as Response);

  await expect(
    Promise.all([
      getMapPlaces(["batch-a", "batch-b"]),
      getMapPlaces(["batch-b", "batch-c"]),
    ]),
  ).resolves.toEqual([
    [
      expect.objectContaining({ id: "batch-a" }),
      expect.objectContaining({ id: "batch-b" }),
    ],
    [
      expect.objectContaining({ id: "batch-b" }),
      expect.objectContaining({ id: "batch-c" }),
    ],
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/public/map/places?ids=batch-a%2Cbatch-b%2Cbatch-c",
    expect.objectContaining({
      signal: expect.any(AbortSignal),
      credentials: "omit",
    }),
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
    "/api/public/map/places/seed%3Amerged-rome",
    expect.objectContaining({
      signal: expect.any(AbortSignal),
      credentials: "omit",
    }),
  );
  fetchMock.mockRestore();
});

test("sends exact-place role refinements as a bounded query parameter", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({ items: [] }),
  } as Response);

  await listMapPlaceEntities("seed:rome", ["SOURCE"], ["DISCOVERED_AT"]);

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

test("approved Map reads use an anonymous representation while personal snapshots retain their route", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    text: async () =>
      JSON.stringify({
        id: "cache-isolation-place",
        canonicalName: "Rome",
        latitude: 0,
        longitude: 0,
        featureType: "SETTLEMENT",
        content: [],
      }),
  } as Response);
  try {
    await getMapPlace("cache-isolation-place");
    await listMyMapSnapshots();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/public/map/places/cache-isolation-place",
    );
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe("omit");
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).has("authorization"),
    ).toBe(false);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/map/snapshots/mine");
    expect(fetchMock.mock.calls[1][1]?.credentials).not.toBe("omit");
  } finally {
    fetchMock.mockRestore();
  }
});
