import type { MapThumbnailMarker } from "./MapCanvas";
import type { MapEntityLocation } from "./mapApi";

/** Turns the bounded public Map projection into image markers without making
 * every page reinvent the resource-type and marker-key conventions. */
export function entityThumbnailMarkers(
  entities: MapEntityLocation[],
  thumbnails: Record<string, string>,
  excludedKeys: ReadonlySet<string> = new Set(),
): MapThumbnailMarker[] {
  return entities
    .filter(
      (entity) =>
        !excludedKeys.has(
          `${entity.entityType}:${entity.entityId}:${entity.locationRole}`,
        ),
    )
    .map((entity) => ({
      key: `${entity.entityType}:${entity.entityId}:${entity.locationRole}`,
      entityType: entity.entityType,
      entityId: entity.entityId,
      locationRole: entity.locationRole,
      label: entity.label,
      placeId: entity.placeId,
      placeName: entity.placeName,
      latitude: entity.latitude,
      longitude: entity.longitude,
      thumbnailUrl: thumbnails[`${entity.entityType}:${entity.entityId}`],
    }));
}
