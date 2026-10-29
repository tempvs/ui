const fs = require("fs");
const path = require("path");

const mapDirectory = path.join(__dirname, "..", "public", "maps");
const inputs = [
  ["ne_110m_land.geojson", "land"],
  ["ne_110m_lakes.geojson", "lakes"],
  ["ne_110m_admin_0_boundary_lines_land.geojson", "borders"],
];
const features = inputs.flatMap(([file, kind]) => {
  const value = JSON.parse(fs.readFileSync(path.join(mapDirectory, file), "utf8"));
  return value.features.map((feature) => ({
    ...feature,
    properties: { ...(feature.properties || {}), tempvsBasemapKind: kind },
  }));
});

fs.writeFileSync(
  path.join(mapDirectory, "basemap.geojson"),
  JSON.stringify({ type: "FeatureCollection", features }),
);
