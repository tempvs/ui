import {
  getClub,
  getParticipants,
  getProfileClubs,
  type Club,
} from "../club/clubApi";
import {
  getSource,
  getSourcesByIds,
  type LibrarySource,
} from "../library/libraryApi";
import { getImageThumbnails } from "../image/imageApi";
import {
  getClubProfiles,
  getUserProfileByUserId,
  fetchProfileById,
} from "../profile/profileApi";
import { getGroupItems, getProfileStash } from "../profile/stashApi";
import { getEvent, type TempvsEvent } from "../event/eventApi";
import type { Profile } from "../profile/profileTypes";
import { getMapPlace, type MapPlace } from "./mapApi";
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
  eventEndsAt?: string;
  path: string;
};

/** Private relationship edges drawn only for the signed-in person's map
 * overlay. They are never sent to public Map API callers. */
export type OwnedMapConnection = {
  key: string;
  fromKey: string;
  toKey: string;
  kind: "PROFILE_SOURCE" | "PROFILE_CLUB" | "USER_CLUB_PROFILE";
};

export type OwnedMapContent = {
  markers: OwnedMapMarker[];
  connections: OwnedMapConnection[];
};

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
}

/** A club-location counterpart to the profile overlay. The club API returns a
 * cursor-paginated member list; the compact modal deliberately renders its
 * first bounded page rather than turning a map click into an unbounded crawl. */
export async function loadClubRelatedMapContent(
  club: Club,
): Promise<OwnedMapContent> {
  const resolvePlace = placeResolver();
  const [clubMarkers, participantPage] = await Promise.all([
    clubMapMarkers([club], resolvePlace),
    getParticipants(club.id).catch(() => ({ content: [] })),
  ]);
  const participants = participantPage.content;
  const profileMarkers = await profileMapMarkers(participants, resolvePlace);
  const markers = [...clubMarkers, ...profileMarkers];
  const memberships = new Map(
    participants.map((profile) => [profile.id, [club]]),
  );
  return {
    markers,
    connections: buildConnections(
      markers,
      undefined,
      participants,
      memberships,
      new Map(),
    ),
  };
}

/** A source page has no private relationship expansion: its public slice is
 * simply every approved location carried by that source (discovery and/or
 * holding). Keeping this as an overlay makes it use the same marker code as
 * the profile and club share links. */
export async function loadSourceRelatedMapContent(
  source: LibrarySource,
): Promise<OwnedMapContent> {
  const resolvePlace = placeResolver();
  const markers = await sourceMapMarkers(
    [source.id],
    resolvePlace,
  );
  return { markers, connections: [] };
}

/** Events are shareable public map scopes too. Their venue and historical-site
 * pins deliberately travel with the URL instead of becoming the recipient's
 * private map overlay. */
export async function loadEventRelatedMapContent(
  event: TempvsEvent,
): Promise<OwnedMapContent> {
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
        ...(eventEndsAt ? { eventEndsAt } : {}),
        path: `/events/${encodeURIComponent(event.id)}`,
      });
    }),
  );
  return {
    markers: markers.filter((value): value is OwnedMapMarker => Boolean(value)),
    connections: [],
  };
}

/** Resolve a URL-addressable public page slice. Do not substitute the viewer
 * here: a copied URL must show the same resource graph to every recipient. */
export async function loadSharedMapScope(
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
      const profile = await profileById(scope.id);
      return profile
        ? loadProfileRelatedMapContent(profile)
        : emptyMapContent();
    }
    case "CLUB": {
      const club = await getClub(scope.id).catch(() => null);
      return club ? loadClubRelatedMapContent(club) : emptyMapContent();
    }
    case "EVENT": {
      const event = await getEvent(scope.id).catch(() => null);
      return event ? loadEventRelatedMapContent(event) : emptyMapContent();
    }
    case "SOURCE": {
      const result = await getSource(scope.id).catch(() => null);
      return result?.ok && result.data
        ? loadSourceRelatedMapContent(result.data)
        : emptyMapContent();
    }
  }
}

/**
 * A partial private overlay. MapPage uses these snapshots to make the map
 * useful as soon as the viewer's own profiles resolve, rather than waiting
 * for every optional club, stash, source and thumbnail request to settle.
 */
export type OwnedMapContentProgress = OwnedMapContent;

type Located = {
  locationPlaceId?: string | null;
  location?: string | null;
};

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
  const resolvePlace = placeResolver();

  // Profiles need only their canonical place and avatar, whereas clubs and
  // source locations require additional membership/stash reads. Publish the
  // profile subset first so opening the Map does not wait on the slowest
  // optional branch before framing the viewer's locations.
  const profileMarkersPromise = profileMapMarkers(profiles, resolvePlace);
  const membershipsPromise = clubsByProfile(profiles);
  const sourceUsagePromise = sourceIdsUsedByProfiles(profiles);
  const profileMarkers = await profileMarkersPromise;
  onProgress?.({ markers: profileMarkers, connections: [] });

  const [memberships, sourceUsage] = await Promise.all([
    membershipsPromise,
    sourceUsagePromise,
  ]);
  const clubs = uniqueById(
    Array.from(memberships.values()).flatMap((profileClubs) => profileClubs),
  );
  const sourceIds = Array.from(
    new Set(Array.from(sourceUsage.values()).flat()),
  );
  const clubMarkersPromise = clubMapMarkers(clubs, resolvePlace);
  const sourceMarkersPromise = sourceMapMarkers(
    sourceIds,
    resolvePlace,
    true,
  );
  const clubMarkers = await clubMarkersPromise;
  // Club locations usually resolve before all stash-linked sources. Fit those
  // too; a final snapshot below extends the frame to every available point.
  onProgress?.({
    markers: [...profileMarkers, ...clubMarkers],
    connections: [],
  });
  const sourceMarkers = await sourceMarkersPromise;
  const markers = [...profileMarkers, ...clubMarkers, ...sourceMarkers];
  return {
    markers,
    connections: buildConnections(
      markers,
      personalProfile?.id,
      profiles,
      memberships,
      sourceUsage,
    ),
  };
}

async function profileMapMarkers(
  profiles: Profile[],
  resolvePlace: PlaceResolver,
): Promise<OwnedMapMarker[]> {
  const thumbnails = await thumbnailUrls(
    profiles.map((profile) => ({ resourceType: "profile", resourceId: profile.id })),
  );
  const prepared = await Promise.all(
    profiles.map(async (profile) => {
      const place = await placeFor(profile, resolvePlace);
      if (!place || !profile.locationPlaceId) return null;
      return marker({
        entityType: "PROFILE",
        entityId: profile.id,
        locationRole: "CURRENT_RESIDENCE",
        label: profileLabel(profile),
        placeId: profile.locationPlaceId,
        placeName: profile.location || place.canonicalName,
        latitude: place.latitude,
        longitude: place.longitude,
        thumbnailUrl: thumbnails.get(`profile:${profile.id}`) || profile.avatarUrl,
        ...(profile.period ? { periods: [profile.period] } : {}),
        path: `/profile/${encodeURIComponent(profile.alias || profile.id)}`,
      });
    }),
  );
  return prepared.filter((value): value is OwnedMapMarker => Boolean(value));
}

async function clubsByProfile(
  profiles: Profile[],
): Promise<Map<string, Club[]>> {
  const results = await Promise.allSettled(
    profiles.map((profile) => getProfileClubs(profile.id)),
  );
  return new Map(
    profiles.map((profile, index) => {
      const result = results[index];
      return [
        profile.id,
        result && result.status === "fulfilled" ? result.value : [],
      ];
    }),
  );
}

async function clubMapMarkers(
  clubs: Club[],
  resolvePlace: PlaceResolver,
): Promise<OwnedMapMarker[]> {
  const thumbnails = await thumbnailUrls(
    clubs.map((club) => ({ resourceType: "club", resourceId: club.id })),
  );
  const prepared = await Promise.all(
    clubs.map(async (club) => {
      const place = await placeFor(club, resolvePlace);
      if (!place || !club.locationPlaceId) return null;
      return marker({
        entityType: "CLUB",
        entityId: String(club.id),
        locationRole: "CLUB_ASSOCIATION",
        label: club.name,
        placeId: club.locationPlaceId,
        placeName: club.location || place.canonicalName,
        latitude: place.latitude,
        longitude: place.longitude,
        thumbnailUrl:
          club.photoThumbnailUrl ||
          club.photoUrl ||
          thumbnails.get(`club:${club.id}`) ||
          null,
        ...(club.period ? { periods: [club.period] } : {}),
        path: `/clubs/${encodeURIComponent(club.alias || String(club.id))}`,
      });
    }),
  );
  return prepared.filter((value): value is OwnedMapMarker => Boolean(value));
}

async function sourceIdsUsedByProfiles(
  profiles: Profile[],
): Promise<Map<string, string[]>> {
  const stashes = await Promise.allSettled(
    profiles.map((profile) => getProfileStash(profile.id)),
  );
  const sourceIds = await Promise.all(
    profiles.map(async (profile, index) => {
      const stash = stashes[index];
      if (stash.status !== "fulfilled") return [profile.id, []] as const;
      const pages = await Promise.allSettled(
        (stash.value.groups || []).map((group) => getGroupItems(group.id)),
      );
      return [
        profile.id,
        Array.from(
          new Set(
            pages.flatMap((result) =>
              result.status === "fulfilled"
                ? result.value.flatMap((item) => item.sources || [])
                : [],
            ),
          ),
        ),
      ] as const;
    }),
  );
  return new Map(sourceIds.map(([profileId, ids]) => [profileId, [...ids]]));
}

async function sourceMapMarkers(
  sourceIds: string[],
  resolvePlace: PlaceResolver,
  primaryLocationOnly = false,
): Promise<OwnedMapMarker[]> {
  const [sources, thumbnails] = await Promise.all([
    getSourcesByIds(sourceIds).catch(() => []),
    thumbnailUrls(sourceIds.map((resourceId) => ({ resourceType: "source", resourceId }))),
  ]);
  const sourceLocationsToResolve = sources
    .flatMap((source) =>
      sourceLocations(source, primaryLocationOnly).map((location) => ({
        source,
        location,
      })),
    );
  const markers = await Promise.all(
    sourceLocationsToResolve.map(async ({ source, location }) => {
      const place = await resolvePlace(location.placeId);
      if (!place) return null;
      return marker({
        entityType: "SOURCE",
        entityId: source.id,
        locationRole: location.role,
        label: source.name || "Untitled source",
        placeId: location.placeId,
        placeName: location.placeName || place.canonicalName,
        latitude: place.latitude,
        longitude: place.longitude,
        thumbnailUrl: thumbnails.get(`source:${source.id}`) || null,
        ...(source.period ? { periods: [source.period] } : {}),
        path: `/library/source/${encodeURIComponent(source.id)}`,
      });
    }),
  );
  return deduplicateEquivalentSourceMarkers(
    markers.filter((value): value is OwnedMapMarker => Boolean(value)),
  );
}

/**
 * A source may use two catalogue records for one town (for example a modern
 * settlement and its historical-settlement record). Those roles remain
 * independently stored, but a pair with the same resolved coordinate is one
 * visual location. Discovery wins because it is the primary source location.
 */
function deduplicateEquivalentSourceMarkers(
  markers: OwnedMapMarker[],
): OwnedMapMarker[] {
  return markers.filter((marker) => {
    if (marker.locationRole !== "HELD_AT") return true;
    return !markers.some(
      (candidate) =>
        candidate.entityId === marker.entityId &&
        candidate.locationRole === "DISCOVERED_AT" &&
        sameCoordinates(candidate, marker),
    );
  });
}

function sameCoordinates(
  left: Pick<OwnedMapMarker, "latitude" | "longitude">,
  right: Pick<OwnedMapMarker, "latitude" | "longitude">,
): boolean {
  // Imported locations can differ by insignificant floating-point precision.
  return (
    Math.abs(left.latitude - right.latitude) < 0.00001 &&
    Math.abs(left.longitude - right.longitude) < 0.00001
  );
}

type SourceLocation = {
  placeId: string;
  placeName: string | null | undefined;
  role: "DISCOVERED_AT" | "HELD_AT";
};

function sourceLocations(
  source: LibrarySource,
  primaryLocationOnly = false,
): SourceLocation[] {
  const discovered = source.discoveredAtPlaceId
    ? {
        placeId: source.discoveredAtPlaceId,
        placeName: source.discoveredAtPlaceName,
        role: "DISCOVERED_AT" as const,
      }
    : null;
  const held = source.heldAtPlaceId
    ? {
        placeId: source.heldAtPlaceId,
        placeName: source.heldAtPlaceName,
        role: "HELD_AT" as const,
      }
    : null;
  // Discovery is the primary historical association. A second marker at the
  // same approved place only stacks duplicate thumbnails without conveying
  // new information, so retain one discovery marker in that case.
  if (discovered && primaryLocationOnly) return [discovered];
  return [
    discovered,
    held && held.placeId !== discovered?.placeId ? held : null,
  ].filter((location): location is SourceLocation => Boolean(location));
}

type PlaceResolver = (placeId: string) => Promise<MapPlace | null>;

function placeResolver(): PlaceResolver {
  const reads = new Map<string, Promise<MapPlace | null>>();
  return (placeId) => {
    const existing = reads.get(placeId);
    if (existing) return existing;
    const read = getMapPlace(placeId).catch(() => null);
    reads.set(placeId, read);
    return read;
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
        return url ? [[`${entry.resourceType}:${entry.resourceId}`, url] as const] : [];
      }),
    );
  } catch {
    return new Map();
  }
}

async function placeFor(value: Located, resolvePlace: PlaceResolver) {
  return value.locationPlaceId ? resolvePlace(value.locationPlaceId) : null;
}

function marker(value: Omit<OwnedMapMarker, "key">): OwnedMapMarker {
  return {
    ...value,
    key: `${value.entityType}:${value.entityId}:${value.locationRole}`,
  };
}

function mapEventEndsAt(event: TempvsEvent): string | undefined {
  const schedule = event.schedule;
  if (!schedule) return undefined;
  if (schedule.kind === "RECURRING") return schedule.recurrence?.until;
  return schedule.endsAt;
}

function buildConnections(
  markers: OwnedMapMarker[],
  personalProfileId: string | undefined,
  profiles: Profile[],
  memberships: Map<string, Club[]>,
  sourceUsage: Map<string, string[]>,
): OwnedMapConnection[] {
  const byEntity = new Map<string, OwnedMapMarker[]>();
  markers.forEach((value) => {
    const key = `${value.entityType}:${value.entityId}`;
    byEntity.set(key, [...(byEntity.get(key) || []), value]);
  });
  const connections: OwnedMapConnection[] = [];
  const connect = (
    fromEntity: string,
    toEntity: string,
    kind: OwnedMapConnection["kind"],
  ) => {
    for (const from of byEntity.get(fromEntity) || []) {
      for (const to of byEntity.get(toEntity) || []) {
        if (from.key === to.key) continue;
        connections.push({
          key: `${kind}:${from.key}:${to.key}`,
          fromKey: from.key,
          toKey: to.key,
          kind,
        });
      }
    }
  };
  profiles.forEach((profile) => {
    const profileEntity = `PROFILE:${profile.id}`;
    (memberships.get(profile.id) || []).forEach((club) =>
      connect(profileEntity, `CLUB:${club.id}`, "PROFILE_CLUB"),
    );
    (sourceUsage.get(profile.id) || []).forEach((sourceId) =>
      connect(profileEntity, `SOURCE:${sourceId}`, "PROFILE_SOURCE"),
    );
    if (personalProfileId && profile.type === "CLUB")
      connect(
        `PROFILE:${personalProfileId}`,
        profileEntity,
        "USER_CLUB_PROFILE",
      );
  });
  return connections;
}

function profileLabel(profile: Profile): string {
  const fullName = [profile.firstName, profile.lastName]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
  return profile.nickName?.trim() || fullName || "Unnamed profile";
}

function emptyMapContent(): OwnedMapContent {
  return { markers: [], connections: [] };
}

function profileById(id: string): Promise<Profile | null> {
  return new Promise((resolve) => {
    fetchProfileById(id, {
      onSuccess: resolve,
      onMissing: () => resolve(null),
      onError: () => resolve(null),
    });
  });
}

function uniqueById<T extends { id: string | number }>(values: T[]): T[] {
  return Array.from(
    new Map(values.map((value) => [String(value.id), value])).values(),
  );
}
