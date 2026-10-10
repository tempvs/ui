import { loadPlaceAncestors } from "./MapPlacePage";
import { getMapPlace, type MapPlace } from "./mapApi";

jest.mock("./mapApi", () => ({
  getMapPlace: jest.fn(),
  listMapPlaceChildren: jest.fn(),
  listMapPlaceEntities: jest.fn(),
}));

const mockGetMapPlace = jest.mocked(getMapPlace);

function place(id: string, parentPlaceId?: string): MapPlace {
  return {
    id,
    canonicalName: id,
    latitude: 0,
    longitude: 0,
    featureType: "SETTLEMENT",
    ...(parentPlaceId ? { parentPlaceId } : {}),
  };
}

test("loads canonical ancestors root-first and stops at a malformed cycle", async () => {
  const places: Record<string, MapPlace> = {
    region: place("region"),
    country: place("country", "region"),
    town: place("town", "country"),
  };
  mockGetMapPlace.mockImplementation(async (id) => places[id] || null);

  await expect(loadPlaceAncestors(places.town)).resolves.toEqual([
    places.region,
    places.country,
  ]);

  places.region.parentPlaceId = "town";
  await expect(loadPlaceAncestors(places.town)).resolves.toEqual([
    places.region,
    places.country,
  ]);
});
