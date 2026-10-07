export type MapPlace = {
  id: string;
  canonicalName: string;
  latitude: number;
  longitude: number;
  featureType: string;
};

export type MapEntityLocation = {
  entityType: "PROFILE" | "CLUB" | "EVENT" | "SOURCE";
  entityId: string;
  locationRole:
    | "CURRENT_RESIDENCE"
    | "CLUB_ASSOCIATION"
    | "VENUE"
    | "DISCOVERED_AT"
    | "HELD_AT";
  label: string;
  placeId: string;
  placeName: string;
  latitude: number;
  longitude: number;
};

async function responseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/** Public approved-place lookup through the same-origin Map API. */
export async function searchMapPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<MapPlace[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];
  const response = await fetch(
    `/api/map/places/search?${new URLSearchParams({ q: normalized, limit: "20" })}`,
    { signal },
  );
  if (!response.ok) throw new Error("Unable to search places");
  const body = (await responseJson(response)) as { items?: unknown } | null;
  const items = body?.items;
  return Array.isArray(items) ? (items as MapPlace[]) : [];
}

/** Load one canonical place for a stable, shareable map deep link. */
export async function getMapPlace(
  id: string,
  signal?: AbortSignal,
): Promise<MapPlace | null> {
  const response = await fetch(`/api/map/places/${encodeURIComponent(id)}`, {
    signal,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Unable to load this place");
  return (await responseJson(response)) as MapPlace;
}

/** Public bounded-radius lookup through the same-origin Map API. */
export async function nearbyMapPlaces(
  latitude: number,
  longitude: number,
  radiusKm: number,
  signal?: AbortSignal,
): Promise<MapPlace[]> {
  const response = await fetch(
    `/api/map/places/search?${new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      radiusKm: String(radiusKm),
      limit: "50",
    })}`,
    { signal },
  );
  if (!response.ok) throw new Error("Unable to find nearby places");
  const body = (await responseJson(response)) as { items?: unknown } | null;
  return Array.isArray(body?.items) ? (body?.items as MapPlace[]) : [];
}

/** Public, denormalized entity markers near a point. Map owns this read model
 * so discovery never fans out to four service APIs. */
export async function nearbyMapEntities(
  latitude: number,
  longitude: number,
  radiusKm: number,
  types: MapEntityLocation["entityType"][] = [],
  signal?: AbortSignal,
): Promise<MapEntityLocation[]> {
  const response = await fetch(
    `/api/map/entities?${new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      radiusKm: String(radiusKm),
      limit: "100",
      ...(types.length ? { types: types.join(",") } : {}),
    })}`,
    { signal },
  );
  if (!response.ok) throw new Error("Unable to find nearby content");
  const body = (await responseJson(response)) as { items?: unknown } | null;
  return Array.isArray(body?.items) ? (body?.items as MapEntityLocation[]) : [];
}
