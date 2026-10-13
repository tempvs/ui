import { MAP_ATTRIBUTION } from "./MapCanvas";

test("keeps required Natural Earth attribution in every MapCanvas variant", () => {
  expect(MAP_ATTRIBUTION).toBe("Made with Natural Earth");
});
