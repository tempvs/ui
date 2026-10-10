import { matchingPlaceName } from "./placeNames";

const place = {
  id: "seed:constantinople",
  canonicalName: "Istanbul, Türkiye",
  latitude: 41,
  longitude: 29,
  featureType: "SETTLEMENT",
  names: [
    { value: "Byzantium", preferred: false, validTo: 329 },
    { value: "Constantinople", preferred: true, validFrom: 330, validTo: 1929 },
    { value: "Istanbul, Türkiye", preferred: true, validFrom: 1930 },
  ],
};

describe("matchingPlaceName", () => {
  it("chooses the preferred name overlapping the entity's historical years", () => {
    expect(matchingPlaceName(place, "", { from: 500, to: 600 })).toBe(
      "Constantinople",
    );
    expect(matchingPlaceName(place, "", { from: 2000 })).toBe(
      "Istanbul, Türkiye",
    );
  });

  it("keeps an explicitly searched alias over the default historical label", () => {
    expect(matchingPlaceName(place, "byzan", { from: -100, to: 300 })).toBe(
      "Byzantium",
    );
  });
});
