import { MAP_ATTRIBUTION, ownedConnectionCollection } from "./MapCanvas";

test("keeps required Natural Earth attribution in every MapCanvas variant", () => {
  expect(MAP_ATTRIBUTION).toBe("Made with Natural Earth");
});

test("renders a visible relationship loop for markers at the same place", () => {
  const collection = ownedConnectionCollection(
    [
      {
        key: "PROFILE_SOURCE:profile:source",
        fromKey: "PROFILE:profile:CURRENT_RESIDENCE",
        toKey: "SOURCE:source:DISCOVERED_AT",
        kind: "PROFILE_SOURCE",
      },
    ],
    [
      {
        key: "PROFILE:profile:CURRENT_RESIDENCE",
        latitude: 41.9,
        longitude: 12.5,
      },
      {
        key: "SOURCE:source:DISCOVERED_AT",
        latitude: 41.9,
        longitude: 12.5,
      },
    ] as never,
  );

  const coordinates = collection.features[0]?.geometry.coordinates;
  expect(coordinates).toHaveLength(17);
  expect(
    coordinates?.some(
      ([longitude, latitude]) => longitude !== 12.5 || latitude !== 41.9,
    ),
  ).toBe(true);
});
