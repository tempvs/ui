import { getClub, type Club } from "../club/clubApi";
import { getSource, getSourceImages, type LibrarySource, type LibrarySourceImage } from "../library/libraryApi";
import { getImageThumbnails } from "../image/imageApi";
import {
  getClubProfiles,
  getProfilesByIds,
  getUserProfileByUserId,
} from "../profile/profileApi";
import { getEvent, type TempvsEvent } from "../event/eventApi";
import type { Profile } from "../profile/profileTypes";
import {
  getMapPlacesByReference,
  getMapProjection,
  getMapProjections,
  type MapProjection,
} from "./mapApi";
import type { SharedMapScope } from "./sharedMapScope";

export type OwnedMapMarker = {
  key: string;
  entityType: "PROFILE" | "CLUB" | "EVENT" | "SOURCE";
  entityId: string;
  locationRole:
    | "CURRENT_RESIDENCE"
    | "CLUB_ASSOCIATION"
    | "VENUE"
    | "HISTORICAL_SITE"
    | "DISCOVERED_AT"
    | "HELD_AT";
  label: string;
  placeId: string;
  placeName: string;
  latitude: number;
  longitude: number;
  thumbnailUrl?: string | null;
  periods?: string[];
  temporalFrom?: number;
  temporalTo?: number;
  eventEndsAt?: string;
  /** Retained from Map's location projection so profile choices are clear in
   * a personal graph. Non-profile pins intentionally omit this field. */
  profileType?: "USER" | "CLUB";
  path: string;
};

/** Private relationship edges drawn only for the signed-in person's map
 * overlay. They are never sent to public Map API callers. */
export type OwnedMapConnection = {
  key: string;
  fromKey: string;
  toKey: string;
  kind:
    | "PROFILE_SOURCE"
    | "PROFILE_CLUB"
    | "USER_CLUB_PROFILE"
    | "SOURCE_LOCATIONS"
    | "EVENT_LOCATIONS";
};

/** A profile which can control the viewer-owned map graph. A profile need not
 * have a map location itself (and therefore need not have a marker) to be a
 * meaningful choice: hiding the user also hides their owned club profiles. */
export type OwnedMapProfile = {
  id: string;
  label: string;
  profileType: "USER" | "CLUB";
  ownerProfileId?: string;
};

export type OwnedMapContent = {
  truncated?: boolean;
  markers: OwnedMapMarker[];
  connections: OwnedMapConnection[];
  profiles?: OwnedMapProfile[];
};

/** Apply the profile choices made by the author of a personal map. A related
 * club or source remains when another visible profile also connects to it. */
export function filterOwnedMapContentByProfiles(
  content: OwnedMapContent,
  hiddenProfileIds: readonly string[],
): OwnedMapContent {
  const hidden = new Set(hiddenProfileIds);
  content.profiles?.forEach((profile) => {
    if (profile.ownerProfileId && hidden.has(profile.ownerProfileId))
      hidden.add(profile.id);
  });
  if (!hidden.size) return content;
  const profileKeys = new Set(
    content.markers
      .filter((marker) => marker.entityType === "PROFILE" && hidden.has(marker.entityId))
      .map((marker) => marker.key),
  );
  const hiddenTargets = new Set<string>();
  const visibleTargets = new Set<string>();
  content.connections.forEach((connection) => {
    if (connection.kind !== "PROFILE_SOURCE" && connection.kind !== "PROFILE_CLUB") return;
    const target = profileKeys.has(connection.fromKey)
      ? connection.toKey
      : profileKeys.has(connection.toKey)
        ? connection.fromKey
        : null;
    if (target) hiddenTargets.add(target);
    else {
      const profileEndpoint = content.markers.find(
        (marker) => marker.key === connection.fromKey || marker.key === connection.toKey,
      );
      if (profileEndpoint?.entityType === "PROFILE" && !hidden.has(profileEndpoint.entityId))
        visibleTargets.add(profileEndpoint.key === connection.fromKey ? connection.toKey : connection.fromKey);
    }
  });
  const hiddenKeys = new Set([
    ...Array.from(profileKeys),
    ...Array.from(hiddenTargets).filter((key) => !visibleTargets.has(key)),
  ]);
  const markers = content.markers.filter((marker) => !hiddenKeys.has(marker.key));
  return {
    ...content,
    markers,
    connections: content.connections.filter(
      (connection) => !hiddenKeys.has(connection.fromKey) && !hiddenKeys.has(connection.toKey),
    ),
  };
}

const sharedScopeReadTtlMs = 30_000;
const sharedScopeReads = new Map<
  string,
  { expiresAt: number; request: Promise<OwnedMapContent> }
>();

/**
 * A deliberately bounded public-page overlay. It is assembled from the same
 * public profile, club, collection and source reads already used by the page;
 * it is not added to Map's public proximity projection, where relationship
 * data would be queryable by anyone. The caller chooses when the relationship
 * is appropriate to reveal (currently, the profile's own location globe).
 */
export async function loadProfileRelatedMapContent(
  profile: Profile,
): Promise<OwnedMapContent> {
  return projectionMapContent("PROFILE", profile.id);
  /* Legacy graph composition retained below temporarily as a migration
   * fallback reference. Projection reads are the production path. */
  /*
  const resolvePlace = placeResolver();
  const [profileMarkers, memberships, sourceUsage] = await Promise.all([
    profileMapMarkers([profile], resolvePlace),
    clubsByProfile([profile]),
    sourceIdsUsedByProfiles([profile]),
  ]);
  const clubs = uniqueById(
    Array.from(memberships.values()).flatMap((items) => items),
  );
  const sourceIds = Array.from(
    new Set(Array.from(sourceUsage.values()).flat()),
  );
  const [clubMarkers, sourceMarkers] = await Promise.all([
    clubMapMarkers(clubs, resolvePlace),
    sourceMapMarkers(sourceIds, resolvePlace, true),
  ]);
  const markers = [...profileMarkers, ...clubMarkers, ...sourceMarkers];
  return {
    markers,
    connections: buildConnections(
      markers,
      undefined,
      [profile],
      memberships,
      sourceUsage,
    ),
  };
  */
}

/** A club map is intentionally just the club's own canonical location.
 * Membership is a relationship of a profile map, not a reason to fetch or
 * expose every member's location when somebody opens a club map. Besides
 * keeping the scope truthful, this avoids a second profile/thumbnail/place
 * traversal for every club card and keeps the modal bounded to one point. */
export async function loadClubRelatedMapContent(
  club: Club,
): Promise<OwnedMapContent> {
  return projectionMapContent("CLUB", String(club.id), clubLocations(club));
}

function clubLocations(club: Club): RelatedLocation[] {
  return [
    {
      entityType: "CLUB",
      entityId: String(club.id),
      locationRole: "CLUB_ASSOCIATION",
      label: club.name,
      placeId: club.locationPlaceId,
      placeName: club.location,
      thumbnailUrl: club.photoThumbnailUrl || club.photoUrl,
    },
  ];
}

/** A source page has no private relationship expansion: its public slice is
 * simply every approved location carried by that source (discovery and/or
 * holding). Keeping this as an overlay makes it use the same marker code as
 * the profile and club share links. */
export async function loadSourceRelatedMapContent(
  source: LibrarySource,
  firstImage?: LibrarySourceImage | null,
): Promise<OwnedMapContent> {
  return projectionMapContent("SOURCE", source.id, sourceLocations(source, firstImage));
}

function sourceLocations(source: LibrarySource, firstImage?: LibrarySourceImage | null): RelatedLocation[] {
  return [
    {
      entityType: "SOURCE",
      entityId: source.id,
      locationRole: "DISCOVERED_AT",
      label: source.name || "Source",
      placeId: source.discoveredAtPlaceId,
      placeName: source.discoveredAtPlaceName,
      thumbnailUrl: firstImage?.thumbnailUrl || firstImage?.url,
    },
    {
      entityType: "SOURCE",
      entityId: source.id,
      locationRole: "HELD_AT",
      label: source.name || "Source",
      placeId: source.heldAtPlaceId,
      placeName: source.heldAtPlaceName,
      thumbnailUrl: firstImage?.thumbnailUrl || firstImage?.url,
    },
  ];
}

/** Events are shareable public map scopes too. Their venue and historical-site
 * pins deliberately travel with the URL instead of becoming the recipient's
 * private map overlay. */
export async function loadEventRelatedMapContent(
  event: TempvsEvent,
): Promise<OwnedMapContent> {
  return projectionMapContent("EVENT", event.id, eventLocations(event));
}

function eventLocations(event: TempvsEvent): RelatedLocation[] {
  return [
    {
      entityType: "EVENT",
      entityId: event.id,
      locationRole: "VENUE",
      label: event.name,
      placeId: event.venuePlaceId,
      placeName: event.venuePlaceName,
      thumbnailUrl: event.image?.thumbnailUrl || event.image?.url,
    },
    {
      entityType: "EVENT",
      entityId: event.id,
      locationRole: "HISTORICAL_SITE",
      label: event.name,
      placeId: event.historicalSitePlaceId,
      placeName: event.historicalSitePlaceName,
      thumbnailUrl: event.image?.thumbnailUrl || event.image?.url,
    },
  ];
  /*
  const resolvePlace = placeResolver();
  const locations: Array<{
    placeId: string;
    placeName: string | null | undefined;
    locationRole: "VENUE" | "HISTORICAL_SITE";
  }> = [];
  if (event.venuePlaceId) {
    locations.push({
      placeId: event.venuePlaceId,
      placeName: event.venuePlaceName,
      locationRole: "VENUE",
    });
  }
  if (event.historicalSitePlaceId) {
    locations.push({
      placeId: event.historicalSitePlaceId,
      placeName: event.historicalSitePlaceName,
      locationRole: "HISTORICAL_SITE",
    });
  }
  const eventEndsAt = mapEventEndsAt(event);
  const markers = await Promise.all(
    locations.map(async (location) => {
      const place = await resolvePlace(location.placeId);
      if (!place) return null;
      return marker({
        entityType: "EVENT",
        entityId: event.id,
        locationRole: location.locationRole,
        label: event.name,
        placeId: location.placeId,
        placeName: location.placeName || place.canonicalName,
        latitude: place.latitude,
        longitude: place.longitude,
        thumbnailUrl: event.image?.thumbnailUrl || event.image?.url || null,
        ...(event.periods?.length ? { periods: event.periods } : {}),
        ...historicalRange(event.from, event.to),
        ...(eventEndsAt ? { eventEndsAt } : {}),
        path: `/events/${encodeURIComponent(event.id)}`,
      });
    }),
  );
  return {
    markers: markers.filter((value): value is OwnedMapMarker => Boolean(value)),
    connections: [],
  };
  */
}

/** Resolve a URL-addressable public page slice. Do not substitute the viewer
 * here: a copied URL must show the same resource graph to every recipient. */
export async function loadSharedMapScope(
  scope: SharedMapScope,
): Promise<OwnedMapContent> {
  const key = `${scope.type}:${scope.id}`;
  const now = Date.now();
  const existing = sharedScopeReads.get(key);
  if (existing && existing.expiresAt > now) return existing.request;
  const request = loadSharedMapScopeUncached(scope);
  const entry = { expiresAt: now + sharedScopeReadTtlMs, request };
  sharedScopeReads.set(key, entry);
  request.catch(() => {
    if (sharedScopeReads.get(key) === entry) sharedScopeReads.delete(key);
  });
  return request;
}

async function loadSharedMapScopeUncached(
  scope: SharedMapScope,
): Promise<OwnedMapContent> {
  switch (scope.type) {
    case "USER":
      // A shared personal map intentionally reuses the same public graph as
      // the owner's own Map page. The URL identifies that owner, never the
      // recipient, so copying it cannot silently substitute another user's
      // profiles, clubs, or source relationships.
      return loadOwnedMapContent(scope.id);
    case "PROFILE": {
      return projectionMapContent("PROFILE", scope.id);
    }
    case "CLUB": {
      return loadSharedResourceContent(scope);
    }
    case "EVENT": {
      return loadSharedResourceContent(scope);
    }
    case "SOURCE": {
      return loadSharedResourceContent(scope);
    }
  }
}

/** Reuse the page modal's fallback for older or incomplete projections. This
 * reads at most the originating resource and its one/two places, never the
 * sender's or destination's profile relationships. Complete projections
 * remain the fast path and the shared-scope cache batches concurrent cards. */
async function loadSharedResourceContent(
  scope: SharedMapScope,
): Promise<OwnedMapContent> {
  const content = await projectionMapContent(
    scope.type as MapProjection["scope"], scope.id,
  ).catch(() => ({ markers: [], connections: [] } as OwnedMapContent));
  const expectedCount = scope.type === "CLUB" ? 1 : 2;
  if (content.markers.length >= expectedCount && content.markers.every((pin) => pin.thumbnailUrl))
    return content;

  let expected: RelatedLocation[];
  if (scope.type === "CLUB") {
    expected = clubLocations(await getClub(scope.id));
  } else if (scope.type === "EVENT") {
    expected = eventLocations(await getEvent(scope.id));
  } else {
    const result = await getSource(scope.id);
    if (!result.ok || !result.data) throw new Error("Unable to load shared source map");
    const images = content.markers.some((pin) => pin.thumbnailUrl)
      ? null : await getSourceImages(scope.id).catch(() => null);
    const existingImage = content.markers.find((pin) => pin.thumbnailUrl);
    expected = sourceLocations(result.data, images?.data?.find((image) => image.id === result.data?.coverImageId) || images?.data?.[0] ||
      (existingImage ? { id: existingImage.entityId, thumbnailUrl: existingImage.thumbnailUrl } : null));
  }
  const complete = await addExpectedLocations(content, expected);
  return {
    ...complete,
    connections: completeLocationConnections(complete.markers, complete.connections),
  };
}

async function projectionMapContent(
  scope: MapProjection["scope"],
  id: string,
  expectedLocations: RelatedLocation[] = [],
): Promise<OwnedMapContent> {
  let projection: MapProjection;
  try {
    projection = await getMapProjection(scope, id);
  } catch (error) {
    // Resource pages still know their own one/two approved locations. Use
    // those while an asynchronous projection has not appeared yet (including
    // old records that were never backfilled). Profile maps have no such
    // local fallback and retain the original error behavior.
    if (!expectedLocations.length) throw error;
    projection = { scope, id, markers: [], connections: [], truncated: true };
  }
  const markers = deduplicateProjectionMarkers(projection.markers);
  const [thumbnails, profiles] = await Promise.all([
    thumbnailUrls(
      markers.map((marker) => ({
        resourceType: marker.entityType.toLowerCase() as
          | "profile"
          | "club"
          | "source"
          | "event",
        resourceId: marker.entityId,
      })),
    ),
    getProfilesByIds(
      markers
        .filter((marker) => marker.entityType === "PROFILE")
        .map((marker) => marker.entityId),
    ).catch(() => []),
  ]);
  const profileAliases = new Map(
    profiles.map((profile) => [profile.id, profile.alias?.trim() || profile.id]),
  );
  const content: OwnedMapContent = {
    markers: markers.map((value) => marker({
      entityType: value.entityType,
      entityId: value.entityId,
      locationRole: value.locationRole,
      label: value.label,
      placeId: value.placeId,
      placeName: value.placeName,
      latitude: value.latitude,
      longitude: value.longitude,
      thumbnailUrl: thumbnails.get(`${value.entityType.toLowerCase()}:${value.entityId}`) || null,
      ...(value.sourcePeriod ? { periods: [value.sourcePeriod] } : {}),
      ...(value.eventPeriods?.length ? { periods: value.eventPeriods } : {}),
      temporalFrom: value.sourceFrom ?? value.eventFrom ?? value.profileFrom,
      temporalTo: value.sourceTo ?? value.eventTo ?? value.profileTo,
      ...(value.eventEndsAt ? { eventEndsAt: value.eventEndsAt } : {}),
      ...(value.profileType ? { profileType: value.profileType } : {}),
      path: projectionPath(
        value.entityType,
        value.entityId,
        profileAliases.get(value.entityId),
      ),
    })),
    // New projections persist these edges. Derive the same bounded edges from
    // the already-fetched snapshot for older records until their next async
    // projection refresh; no page traversal or additional request is needed.
    connections: projection.connections,
    ...(projection.truncated ? { truncated: true } : {}),
  };
  const complete = await addExpectedLocations(content, expectedLocations);
  return {
    ...complete,
    connections: completeLocationConnections(complete.markers, complete.connections),
  };
}

type RelatedLocation = {
  entityType: OwnedMapMarker["entityType"];
  entityId: string;
  locationRole: OwnedMapMarker["locationRole"];
  label: string;
  placeId?: string | null;
  placeName?: string | null;
  thumbnailUrl?: string | null;
};

/** A projection is updated asynchronously. A newly changed or legacy page can
 * briefly have no projection (or only one of its two locations), so use the
 * locations already carried by that page as a bounded bridge. This is not a
 * graph traversal: it is one batched place read for only missing pins. */
async function addExpectedLocations(
  content: OwnedMapContent,
  expected: RelatedLocation[],
): Promise<OwnedMapContent> {
  // Use the resource's current avatar/carousel image even when its location
  // was already present in an older projection without thumbnail metadata.
  content = {
    ...content,
    markers: content.markers.map((pin) => {
      const location = expected.find((entry) => entry.entityType === pin.entityType &&
        entry.entityId === pin.entityId && entry.locationRole === pin.locationRole);
      return location?.thumbnailUrl ? { ...pin, thumbnailUrl: location.thumbnailUrl } : pin;
    }),
  };
  const missing = expected.filter(
    (location) =>
      location.placeId &&
      !content.markers.some(
        (marker) =>
          marker.entityType === location.entityType &&
          marker.entityId === location.entityId &&
          marker.locationRole === location.locationRole,
      ),
  );
  if (!missing.length) return content;
  const places = await getMapPlacesByReference(
    Array.from(
      new Set(
        missing.flatMap((location) =>
          location.placeId ? [location.placeId] : [],
        ),
      ),
    ),
  ).catch(() => new Map());
  const absentThumbnailResources = missing
    .filter((location) => !location.thumbnailUrl)
    .map((location) => ({
      resourceType: location.entityType.toLowerCase(),
      resourceId: location.entityId,
    }));
  const thumbnails = await thumbnailUrls(absentThumbnailResources);
  const markers = missing.flatMap((location) => {
    const place = location.placeId ? places.get(location.placeId) : undefined;
    if (!place) return [];
    return [
      marker({
        entityType: location.entityType,
        entityId: location.entityId,
        locationRole: location.locationRole,
        label: location.label,
        placeId: place.id,
        placeName: location.placeName || place.canonicalName,
        latitude: place.latitude,
        longitude: place.longitude,
        thumbnailUrl:
          location.thumbnailUrl ||
          thumbnails.get(`${location.entityType.toLowerCase()}:${location.entityId}`) ||
          null,
        path: projectionPath(location.entityType, location.entityId),
      }),
    ];
  });
  return { ...content, markers: [...content.markers, ...markers] };
}

function completeLocationConnections(
  markers: MapProjection["markers"],
  connections: OwnedMapConnection[],
): OwnedMapConnection[] {
  const next = [...connections];
  const add = (
    entityType: "SOURCE" | "EVENT",
    fromRole: OwnedMapMarker["locationRole"],
    toRole: OwnedMapMarker["locationRole"],
    kind: Extract<
      OwnedMapConnection["kind"],
      "SOURCE_LOCATIONS" | "EVENT_LOCATIONS"
    >,
  ) => {
    const entities = new Set(
      markers
        .filter((marker) => marker.entityType === entityType)
        .map((marker) => marker.entityId),
    );
    entities.forEach((entityId) => {
      const from = markers.find(
        (marker) =>
          marker.entityType === entityType &&
          marker.entityId === entityId &&
          marker.locationRole === fromRole,
      );
      const to = markers.find(
        (marker) =>
          marker.entityType === entityType &&
          marker.entityId === entityId &&
          marker.locationRole === toRole,
      );
      if (!from || !to) return;
      const fromKey = `${from.entityType}:${from.entityId}:${from.locationRole}`;
      const toKey = `${to.entityType}:${to.entityId}:${to.locationRole}`;
      const key = `${kind}:${fromKey}:${toKey}`;
      if (next.some((connection) => connection.fromKey === fromKey && connection.toKey === toKey)) return;
      next.push({ key, fromKey, toKey, kind });
    });
  };
  add("SOURCE", "DISCOVERED_AT", "HELD_AT", "SOURCE_LOCATIONS");
  add("EVENT", "VENUE", "HISTORICAL_SITE", "EVENT_LOCATIONS");
  return next;
}

function deduplicateProjectionMarkers(
  markers: MapProjection["markers"],
): MapProjection["markers"] {
  const preferredProfiles = new Map<string, MapProjection["markers"][number]>();
  markers
    .filter((marker) => marker.entityType === "PROFILE")
    .forEach((marker) => {
      const current = preferredProfiles.get(marker.entityId);
      // A profile can have both a residence and a club-association location.
      // Keep its residence when available, but never use one profile's choice
      // to discard another owned (including club) profile.
      if (!current || marker.locationRole === "CURRENT_RESIDENCE")
        preferredProfiles.set(marker.entityId, marker);
    });
  return markers.filter(
    (marker) =>
      marker.entityType !== "PROFILE" ||
      marker === preferredProfiles.get(marker.entityId),
  );
}

function projectionPath(
  entityType: OwnedMapMarker["entityType"],
  id: string,
  profileAlias?: string,
): string {
  if (entityType === "PROFILE")
    return `/profile/${encodeURIComponent(profileAlias || id)}`;
  if (entityType === "CLUB") return `/clubs/${encodeURIComponent(id)}`;
  if (entityType === "EVENT") return `/events/${encodeURIComponent(id)}`;
  return `/library/source/${encodeURIComponent(id)}`;
}

/**
 * A partial private overlay. MapPage uses these snapshots to make the map
 * useful as soon as the viewer's own profiles resolve, rather than waiting
 * for every optional club, stash, source and thumbnail request to settle.
 */
export type OwnedMapContentProgress = OwnedMapContent;

/**
 * The public Map API deliberately does not expose who owns or belongs to an
 * entity. This browser-side overlay composes that viewer-specific context
 * after authentication, while coordinates still come only from approved map
 * places. A failure for one optional relation never prevents the rest of a
 * user's map from rendering.
 */
export async function loadOwnedMapContent(
  userId: string,
  onProgress?: (content: OwnedMapContentProgress) => void,
): Promise<OwnedMapContent> {
  const [personalResult, clubProfilesResult] = await Promise.allSettled([
    getUserProfileByUserId(userId),
    getClubProfiles(userId),
  ]);
  const personalProfile =
    personalResult.status === "fulfilled" ? personalResult.value : null;
  const profiles = uniqueById(
    [
      personalProfile,
      ...(clubProfilesResult.status === "fulfilled"
        ? clubProfilesResult.value
        : []),
    ].filter((profile): profile is Profile => Boolean(profile)),
  );
  const projections = await getMapProjections(
    "PROFILE",
    profiles.map((profile) => profile.id),
  );
  const projectionContent = await mergeProjectionContent(projections);
  // A profile save publishes its location asynchronously. Older records can
  // also retain an entity-location row without its derived profile graph.
  // Keep /map truthful and useful during either gap by resolving the same
  // approved place that the profile already references; the projection will
  // replace this bounded fallback once it arrives.
  const content = addClubProfileConnections(
    await addExpectedLocations(
      projectionContent,
      profiles
        .filter(
          (profile) =>
            !projectionContent.markers.some(
              (marker) =>
                marker.entityType === "PROFILE" && marker.entityId === profile.id,
            ),
        )
        .flatMap(profileLocations),
    ),
    personalProfile?.id,
    profiles.filter((profile) => profile.id !== personalProfile?.id).map((profile) => profile.id),
  );
  const profileChoices: OwnedMapProfile[] = profiles.map((profile) => ({
    id: profile.id,
    label: profileLabel(profile),
    profileType: profile.id === personalProfile?.id ? "USER" : "CLUB",
    ...(profile.id === personalProfile?.id
      ? {}
      : personalProfile?.id
        ? { ownerProfileId: personalProfile.id }
        : {}),
  }));
  const withProfiles: OwnedMapContent = {
    ...content,
    profiles: profileChoices,
  };
  onProgress?.(withProfiles);
  return withProfiles;
}

function profileLabel(profile: Profile): string {
  return (
    profile.nickName?.trim() ||
    `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() ||
    profile.alias?.trim() ||
    "Profile"
  );
}

function profileLocations(profile: Profile): RelatedLocation[] {
  if (!profile.locationPlaceId) return [];
  return [
    {
      entityType: "PROFILE",
      entityId: profile.id,
      locationRole:
        profile.type === "CLUB" ? "CLUB_ASSOCIATION" : "CURRENT_RESIDENCE",
      label: profileLabel(profile),
      placeId: profile.locationPlaceId,
      placeName: profile.location,
      thumbnailUrl: profile.avatarUrl,
    },
  ];
}

function addClubProfileConnections(
  content: OwnedMapContent,
  personalProfileId: string | undefined,
  clubProfileIds: string[],
): OwnedMapContent {
  const clubProfileIdsSet = new Set(clubProfileIds);
  const markers = content.markers.map((marker) =>
    marker.entityType !== "PROFILE"
      ? marker
      : {
          ...marker,
          // Older projections did not persist profileType. We already know
          // these identities from the authenticated profile reads, so retain
          // a truthful type for the chooser while those projections refresh.
          profileType:
            marker.profileType ||
            (marker.entityId === personalProfileId
              ? "USER"
              : clubProfileIdsSet.has(marker.entityId)
                ? "CLUB"
                : undefined),
        },
  );
  if (!personalProfileId) return { ...content, markers };
  const personal = markers.find(
    (marker) => marker.entityType === "PROFILE" && marker.entityId === personalProfileId,
  );
  if (!personal) return { ...content, markers };
  const connections = [...content.connections];
  clubProfileIds.forEach((clubProfileId) => {
    const clubProfile = markers.find(
      (marker) => marker.entityType === "PROFILE" && marker.entityId === clubProfileId,
    );
    if (!clubProfile) return;
    const key = `USER_CLUB_PROFILE:${personal.key}:${clubProfile.key}`;
    if (!connections.some((connection) => connection.key === key))
      connections.push({ key, fromKey: personal.key, toKey: clubProfile.key, kind: "USER_CLUB_PROFILE" });
  });
  return { ...content, markers, connections };
}

async function mergeProjectionContent(
  projections: MapProjection[],
): Promise<OwnedMapContent> {
  const markers = projections.flatMap((projection) => projection.markers);
  const uniqueMarkers = Array.from(
    new Map(
      deduplicateProjectionMarkers(markers).map((marker) => [
        `${marker.entityType}:${marker.entityId}:${marker.locationRole}`,
        marker,
      ]),
    ).values(),
  );
  const [thumbnails, profiles] = await Promise.all([
    thumbnailUrls(
      uniqueMarkers.map((marker) => ({
        resourceType: marker.entityType.toLowerCase() as
          | "profile"
          | "club"
          | "source"
          | "event",
        resourceId: marker.entityId,
      })),
    ),
    getProfilesByIds(
      uniqueMarkers
        .filter((marker) => marker.entityType === "PROFILE")
        .map((marker) => marker.entityId),
    ).catch(() => []),
  ]);
  const aliases = new Map(
    profiles.map((profile) => [profile.id, profile.alias?.trim() || profile.id]),
  );
  return {
    ...(projections.some((projection) => projection.truncated) ? { truncated: true } : {}),
    markers: uniqueMarkers.map((value) => marker({
      entityType: value.entityType,
      entityId: value.entityId,
      locationRole: value.locationRole,
      label: value.label,
      placeId: value.placeId,
      placeName: value.placeName,
      latitude: value.latitude,
      longitude: value.longitude,
      thumbnailUrl:
        thumbnails.get(`${value.entityType.toLowerCase()}:${value.entityId}`) ||
        null,
      ...(value.profileType ? { profileType: value.profileType } : {}),
      path: projectionPath(
        value.entityType,
        value.entityId,
        aliases.get(value.entityId),
      ),
    })),
    connections: Array.from(
      new Map(
        projections
          .flatMap((projection) => projection.connections)
          .map((connection) => [connection.key, connection]),
      ).values(),
    ),
  };
}

async function thumbnailUrls(
  resources: Array<{ resourceType: string; resourceId: string | number }>,
): Promise<Map<string, string>> {
  try {
    const thumbnails = await getImageThumbnails(resources);
    return new Map(
      thumbnails.flatMap((entry) => {
        const url = entry.image?.thumbnailUrl || entry.image?.url;
        return url
          ? [[`${entry.resourceType}:${entry.resourceId}`, url] as const]
          : [];
      }),
    );
  } catch {
    return new Map();
  }
}

function marker(value: Omit<OwnedMapMarker, "key">): OwnedMapMarker {
  return {
    ...value,
    key: `${value.entityType}:${value.entityId}:${value.locationRole}`,
  };
}

function uniqueById<T extends { id: string | number }>(values: T[]): T[] {
  return Array.from(
    new Map(values.map((value) => [String(value.id), value])).values(),
  );
}
