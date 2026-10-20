import type { MapEntityLocation } from "./mapApi";

/**
 * The general map has one canonical pin per source. Discovery is its primary
 * historical location; a holding location remains a useful fallback only when
 * the source has no discovery projection in the current result set.
 */
export function preferSourceDiscoveryLocations(
  entities: MapEntityLocation[],
): MapEntityLocation[] {
  const sourceIdsWithDiscovery = new Set(
    entities
      .filter(
        (entity) =>
          entity.entityType === "SOURCE" &&
          entity.locationRole === "DISCOVERED_AT",
      )
      .map((entity) => entity.entityId),
  );
  return entities.filter(
    (entity) =>
      !(
        entity.entityType === "SOURCE" &&
        entity.locationRole === "HELD_AT" &&
        sourceIdsWithDiscovery.has(entity.entityId)
      ),
  );
}
