import type { MapEntityLocation } from "./mapApi";
import { preferSourceDiscoveryLocations } from "./sourceLocationPreference";

const source = (
  role: "DISCOVERED_AT" | "HELD_AT",
  id = "source-1",
): MapEntityLocation => ({
  entityType: "SOURCE",
  entityId: id,
  locationRole: role,
  label: "Helmet",
  placeId: role === "DISCOVERED_AT" ? "rome" : "london",
  placeName: role === "DISCOVERED_AT" ? "Rome" : "London",
  latitude: 1,
  longitude: 2,
});

test("prefers a source discovery location over its holding location", () => {
  expect(
    preferSourceDiscoveryLocations([
      source("HELD_AT"),
      source("DISCOVERED_AT"),
    ]),
  ).toEqual([source("DISCOVERED_AT")]);
});

test("retains held-at when no discovery location is available", () => {
  expect(preferSourceDiscoveryLocations([source("HELD_AT")])).toEqual([
    source("HELD_AT"),
  ]);
});
