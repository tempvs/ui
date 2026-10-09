export type MapPlaceName = {
  value: string;
  preferred: boolean;
  validFrom?: number;
  validTo?: number;
};

export type MapHistoricalNameRange = {
  /** Astronomical years used by the Map API. An omitted end stays open. */
  from?: number;
  to?: number;
};

export type MapPlace = {
  id: string;
  canonicalName: string;
  /** Names are returned by the public Map API so choosing a result does not
   * require a second request before its historical context can be displayed. */
  names?: MapPlaceName[];
  latitude: number;
  longitude: number;
  featureType: string;
  description?: string;
  parentPlaceId?: string;
  periods?: string[];
  selectionReasons?: string[];
  provenance?: Array<{
    dataset: string;
    externalId: string;
    license: string;
  }>;
  /** UI-only label for the particular canonical or historical name that
   * matched the user's current search. */
  matchedName?: string;
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
  sourcePeriod?: string;
  sourceClassification?: string;
  sourceType?: string;
  sourceFrom?: number;
  sourceTo?: number;
};

export type MapEntityLocationPage = {
  items: MapEntityLocation[];
  nextCursor?: string;
};

/** A source's two distinct map meanings. These deliberately do not filter
 * profile, club, or event markers when used in a mixed nearby search. */
export type SourceLocationRole = "DISCOVERED_AT" | "HELD_AT";
export type MapSourceFilters = {
  period?: string;
  classifications?: string[];
  types?: string[];
  from?: number;
  to?: number;
};

export type MapPlaceProposal = {
  canonicalName: string;
  latitude: number;
  longitude: number;
  featureType: string;
  description?: string;
  aliases?: string[];
};

/** A non-public point awaiting an editor's approval.  Keeping it separate
 * from MapPlace prevents a pending proposal from accidentally being rendered
 * in a public picker or on the map. */
export type PendingMapPlace = MapPlace & {
  description?: string;
  names?: Array<{ value: string; preferred: boolean }>;
  createdAt?: string;
  createdByUserId?: string;
};

async function responseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/** Public approved-place lookup through the same-origin Map API. */
export async function searchMapPlaces(
  query: string,
  signal?: AbortSignal,
  nameRange: MapHistoricalNameRange = {},
): Promise<MapPlace[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];
  const response = await fetch(
    `/api/map/places/search?${new URLSearchParams({
      q: normalized,
      limit: "20",
      ...(nameRange.from !== undefined ? { from: String(nameRange.from) } : {}),
      ...(nameRange.to !== undefined ? { to: String(nameRange.to) } : {}),
    })}`,
    { signal },
  );
  if (!response.ok) throw new Error("Unable to search places");
  const body = (await responseJson(response)) as {
    items?: unknown;
    nextCursor?: unknown;
  } | null;
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

/** Direct children are deliberately separate from radius discovery: hierarchy
 * navigation never pretends a point has a geographic boundary. */
export async function listMapPlaceChildren(
  placeId: string,
  signal?: AbortSignal,
  cursor?: string,
): Promise<{ items: MapPlace[]; nextCursor?: string }> {
  const response = await fetch(
    `/api/map/places/${encodeURIComponent(placeId)}/children?${new URLSearchParams({
      limit: "50",
      ...(cursor ? { cursor } : {}),
    })}`,
    { signal },
  );
  if (response.status === 404) return { items: [] };
  if (!response.ok) throw new Error("Unable to load child places");
  const body = (await responseJson(response)) as {
    items?: unknown;
    nextCursor?: unknown;
  } | null;
  return {
    items: Array.isArray(body?.items) ? (body?.items as MapPlace[]) : [],
    ...(typeof body?.nextCursor === "string"
      ? { nextCursor: body.nextCursor }
      : {}),
  };
}

/** Public assignments at an exact canonical place. This is intentionally
 * separate from radius discovery so a place page never includes neighbours. */
export async function listMapPlaceEntities(
  placeId: string,
  types: MapEntityLocation["entityType"][] = [],
  signal?: AbortSignal,
  cursor?: string,
): Promise<MapEntityLocationPage> {
  const response = await fetch(
    `/api/map/places/${encodeURIComponent(placeId)}/entities?${new URLSearchParams(
      {
        limit: "100",
        ...(types.length ? { types: types.join(",") } : {}),
        ...(cursor ? { cursor } : {}),
      },
    )}`,
    { signal },
  );
  if (response.status === 404) return { items: [] };
  if (!response.ok) throw new Error("Unable to load content at this place");
  const body = (await responseJson(response)) as {
    items?: unknown;
    nextCursor?: unknown;
  } | null;
  const items = body?.items;
  return {
    items: Array.isArray(items) ? (items as MapEntityLocation[]) : [],
    ...(typeof body?.nextCursor === "string"
      ? { nextCursor: body.nextCursor }
      : {}),
  };
}

/** Public duplicate check for a prospective point. It never exposes pending
 * proposals: only approved canonical places are returned. */
export async function findLikelyDuplicateMapPlaces(
  canonicalName: string,
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<MapPlace[]> {
  const response = await fetch(
    `/api/map/places/duplicates?${new URLSearchParams({
      name: canonicalName,
      latitude: String(latitude),
      longitude: String(longitude),
    })}`,
    { signal },
  );
  if (!response.ok) throw new Error("Unable to check for similar places");
  const body = (await responseJson(response)) as {
    items?: unknown;
    nextCursor?: unknown;
  } | null;
  const items = body?.items;
  return Array.isArray(items) ? (items as MapPlace[]) : [];
}

/** Submit a point proposal. The Map API deliberately keeps it pending until
 * an editor reviews it, so it never leaks into public place search. */
export async function proposeMapPlace(
  proposal: MapPlaceProposal,
): Promise<void> {
  const response = await fetch("/api/map/places/proposals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(proposal),
  });
  if (response.status === 401) throw new Error("Sign in to propose a place");
  if (!response.ok) throw new Error("Unable to submit this place proposal");
}

export type PendingMapPlacePage = {
  items: PendingMapPlace[];
  nextCursor?: string;
};

export async function listPendingMapPlaces(
  cursor?: string,
): Promise<PendingMapPlacePage> {
  const query = cursor ? `?${new URLSearchParams({ cursor })}` : "";
  const response = await fetch(`/api/map/admin/places/proposals${query}`);
  if (response.status === 401 || response.status === 403)
    throw new Error("Map editor access is required");
  if (!response.ok) throw new Error("Unable to load pending place proposals");
  const body = (await responseJson(response)) as {
    items?: unknown;
    nextCursor?: unknown;
  } | null;
  const items = body?.items;
  return {
    items: Array.isArray(items) ? (items as PendingMapPlace[]) : [],
    ...(typeof body?.nextCursor === "string"
      ? { nextCursor: body.nextCursor }
      : {}),
  };
}

export async function approveMapPlace(
  id: string,
  note?: string,
): Promise<void> {
  const response = await fetch(
    `/api/map/admin/places/${encodeURIComponent(id)}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note?.trim() ? { note: note.trim() } : {}),
    },
  );
  if (!response.ok) throw new Error("Unable to approve this place proposal");
}

export async function rejectMapPlace(id: string, note?: string): Promise<void> {
  const response = await fetch(
    `/api/map/admin/places/${encodeURIComponent(id)}/reject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note?.trim() ? { note: note.trim() } : {}),
    },
  );
  if (!response.ok) throw new Error("Unable to reject this place proposal");
}

/** Retain a duplicate proposal for audit, linked to the approved canonical
 * place selected by the editor. The pending point is never made public. */
export async function mergeMapPlace(
  id: string,
  targetPlaceId: string,
  note?: string,
): Promise<void> {
  const response = await fetch(
    `/api/map/admin/places/${encodeURIComponent(id)}/merge`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetPlaceId,
        ...(note?.trim() ? { note: note.trim() } : {}),
      }),
    },
  );
  if (!response.ok) throw new Error("Unable to merge this place proposal");
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
  query?: string,
  signal?: AbortSignal,
  sourceRoles: SourceLocationRole[] = [],
  sourceFilters: MapSourceFilters = {},
): Promise<MapEntityLocation[]> {
  const response = await fetch(
    `/api/map/entities?${new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      radiusKm: String(radiusKm),
      limit: "100",
      ...(types.length ? { types: types.join(",") } : {}),
      ...(query?.trim() ? { search: query.trim() } : {}),
      ...(sourceRoles.length ? { sourceRoles: sourceRoles.join(",") } : {}),
      ...(sourceFilters.period ? { sourcePeriod: sourceFilters.period } : {}),
      ...(sourceFilters.classifications?.length
        ? { sourceClassifications: sourceFilters.classifications.join(",") }
        : {}),
      ...(sourceFilters.types?.length
        ? { sourceTypes: sourceFilters.types.join(",") }
        : {}),
      ...(sourceFilters.from !== undefined
        ? { sourceFrom: String(sourceFilters.from) }
        : {}),
      ...(sourceFilters.to !== undefined
        ? { sourceTo: String(sourceFilters.to) }
        : {}),
    })}`,
    { signal },
  );
  if (!response.ok) throw new Error("Unable to find nearby content");
  const body = (await responseJson(response)) as { items?: unknown } | null;
  return Array.isArray(body?.items) ? (body?.items as MapEntityLocation[]) : [];
}
