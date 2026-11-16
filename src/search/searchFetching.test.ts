import { searchProfilesPage } from "../profile/profileApi";
import { listClubs } from "../club/clubApi";
import { findSources } from "../library/libraryApi";
import { searchEvents } from "../event/eventApi";
import { getMapPlaceEntityCounts, listMapPlaceEntities } from "../map/mapApi";
afterEach(() => jest.restoreAllMocks());
test("catalogue APIs send one multi-period request and propagate cancellation/cursors", async () => {
  const controller = new AbortController();
  const fetchMock = jest.spyOn(global, "fetch").mockImplementation(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ content: [], items: [], counts: { CLUB: 2 } }),
        text: async () =>
          JSON.stringify({
            content: [],
            hasMore: false,
            items: [],
            counts: { CLUB: 2 },
          }),
      }) as Response,
  );
  const periods = ["INTERWAR", "WWII"];
  await searchProfilesPage({
    periods,
    nextToken: "profile-cursor",
    signal: controller.signal,
  });
  await listClubs(
    "rome",
    "",
    "club-cursor",
    controller.signal,
    null,
    null,
    periods,
  );
  await findSources({
    periods,
    nextToken: "source-cursor",
    signal: controller.signal,
  });
  await searchEvents({
    query: "rome",
    periods,
    nextToken: "event-cursor",
    signal: controller.signal,
  });
  expect(fetchMock).toHaveBeenCalledTimes(4);
  fetchMock.mock.calls.forEach(([url, options]) => {
    const params = new URL(String(url), "https://example.test").searchParams;
    expect(params.get("periods")).toBe("INTERWAR,WWII");
    expect(params.get("nextToken")).toMatch(/-cursor$/);
    expect(params.has("page")).toBe(false);
    expect(options?.signal).toBe(controller.signal);
  });
  await listMapPlaceEntities("rome", [], [], controller.signal, "next");
  expect(String(fetchMock.mock.calls[4][0])).toContain("includeCounts=false");
  await getMapPlaceEntityCounts("rome", [], [], controller.signal);
  expect(String(fetchMock.mock.calls[5][0])).toContain("countsOnly=true");
});
