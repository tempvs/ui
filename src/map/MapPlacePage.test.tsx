import { otherHistoricalNames } from "./MapPlacePage";
import type { MapPlace } from "./mapApi";

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

test("returns only labels other than the canonical name for the page summary", () => {
  const town = place("Town");
  town.names = [
    { value: "Town", preferred: true },
    { value: "Old Town", preferred: false, validFrom: 100, validTo: 300 },
    { value: "TOWN", preferred: false, validFrom: 301, validTo: 400 },
  ];

  expect(otherHistoricalNames(town)).toEqual([
    { value: "Old Town", preferred: false, validFrom: 100, validTo: 300 },
  ]);
});
