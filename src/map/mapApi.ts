export type MapPlace = {
  id: string;
  canonicalName: string;
  latitude: number;
  longitude: number;
  featureType: string;
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
