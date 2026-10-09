import { getProfileClubs, type Club } from "../club/clubApi";
import {
  getSource,
  getSourceImages,
  type LibrarySource,
} from "../library/libraryApi";
import {
  getClubProfiles,
  getProfileAvatar,
  getUserProfileByUserId,
} from "../profile/profileApi";
import { getGroupItems, getProfileStash } from "../profile/stashApi";
import type { Profile } from "../profile/profileTypes";
import { getMapPlace, type MapPlace } from "./mapApi";

export type OwnedMapMarker = {
  key: string;
  entityType: "PROFILE" | "CLUB" | "SOURCE";
  entityId: string;
  locationRole:
    "CURRENT_RESIDENCE" | "CLUB_ASSOCIATION" | "DISCOVERED_AT" | "HELD_AT";
  label: string;
  placeId: string;
  placeName: string;
  latitude: number;
  longitude: number;
  thumbnailUrl?: string | null;
  path: string;
};

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
): Promise<OwnedMapMarker[]> {
  const [personalResult, clubProfilesResult] = await Promise.allSettled([
    getUserProfileByUserId(userId),
    getClubProfiles(userId),
  ]);
  const profiles = uniqueById(
    [
      personalResult.status === "fulfilled" ? personalResult.value : null,
      ...(clubProfilesResult.status === "fulfilled"
        ? clubProfilesResult.value
        : []),
    ].filter((profile): profile is Profile => Boolean(profile)),
  );
  const resolvePlace = placeResolver();

  const [profileMarkers, clubs, sourceIds] = await Promise.all([
    profileMapMarkers(profiles, resolvePlace),
    memberClubs(profiles),
    sourceIdsUsedByClubProfiles(
      profiles.filter((profile) => profile.type === "CLUB"),
    ),
  ]);
  const [clubMarkers, sourceMarkers] = await Promise.all([
    clubMapMarkers(clubs, resolvePlace),
    sourceMapMarkers(sourceIds, resolvePlace),
  ]);
  return [...profileMarkers, ...clubMarkers, ...sourceMarkers];
}

async function profileMapMarkers(
  profiles: Profile[],
  resolvePlace: PlaceResolver,
): Promise<OwnedMapMarker[]> {
  const prepared = await Promise.all(
    profiles.map(async (profile) => {
      const [place, avatar] = await Promise.all([
        placeFor(profile, resolvePlace),
        getProfileAvatar(profile.id).catch(() => null),
      ]);
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
        thumbnailUrl: avatar?.thumbnailUrl || avatar?.url || profile.avatarUrl,
        path: `/profile/${encodeURIComponent(profile.alias || profile.id)}`,
      });
    }),
  );
  return prepared.filter((value): value is OwnedMapMarker => Boolean(value));
}

async function memberClubs(profiles: Profile[]): Promise<Club[]> {
  const results = await Promise.allSettled(
    profiles.map((profile) => getProfileClubs(profile.id)),
  );
  return uniqueById(
    results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    ),
  );
}

async function clubMapMarkers(
  clubs: Club[],
  resolvePlace: PlaceResolver,
): Promise<OwnedMapMarker[]> {
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
        thumbnailUrl: club.photoThumbnailUrl || club.photoUrl,
        path: `/clubs/${encodeURIComponent(club.alias || String(club.id))}`,
      });
    }),
  );
  return prepared.filter((value): value is OwnedMapMarker => Boolean(value));
}

async function sourceIdsUsedByClubProfiles(
  profiles: Profile[],
): Promise<string[]> {
  const stashes = await Promise.allSettled(
    profiles.map((profile) => getProfileStash(profile.id)),
  );
  const groups = stashes.flatMap((result) =>
    result.status === "fulfilled" ? result.value.groups || [] : [],
  );
  const itemPages = await Promise.allSettled(
    groups.map((group) => getGroupItems(group.id)),
  );
  return Array.from(
    new Set(
      itemPages.flatMap((result) =>
        result.status === "fulfilled"
          ? result.value.flatMap((item) => item.sources || [])
          : [],
      ),
    ),
  );
}

async function sourceMapMarkers(
  sourceIds: string[],
  resolvePlace: PlaceResolver,
): Promise<OwnedMapMarker[]> {
  const sources = await inBatches(sourceIds, 8, async (sourceId) => {
    const result = await getSource(sourceId);
    return result.ok ? result.data : null;
  });
  const sourceLocationsToResolve = sources
    .flatMap((result) =>
      result.status === "fulfilled" && result.value ? [result.value] : [],
    )
    .flatMap((source) =>
      sourceLocations(source).map((location) => ({ source, location })),
    );
  const markers = await inBatches(
    sourceLocationsToResolve,
    8,
    async ({ source, location }) =>
      sourceMarker(source, location, resolvePlace),
  );
  return markers
    .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    .filter((value): value is OwnedMapMarker => Boolean(value));
}

type SourceLocation = {
  placeId: string;
  placeName: string | null | undefined;
  role: "DISCOVERED_AT" | "HELD_AT";
};

function sourceLocations(source: LibrarySource): SourceLocation[] {
  return [
    source.discoveredAtPlaceId
      ? {
          placeId: source.discoveredAtPlaceId,
          placeName: source.discoveredAtPlaceName,
          role: "DISCOVERED_AT" as const,
        }
      : null,
    source.heldAtPlaceId
      ? {
          placeId: source.heldAtPlaceId,
          placeName: source.heldAtPlaceName,
          role: "HELD_AT" as const,
        }
      : null,
  ].filter((location): location is SourceLocation => Boolean(location));
}

async function sourceMarker(
  source: LibrarySource,
  location: SourceLocation,
  resolvePlace: PlaceResolver,
): Promise<OwnedMapMarker | null> {
  const [place, images] = await Promise.all([
    resolvePlace(location.placeId),
    getSourceImages(source.id).catch(() => null),
  ]);
  if (!place) return null;
  const thumbnail = images?.ok
    ? images.data?.find((image) => image.thumbnailUrl || image.url)
    : null;
  return marker({
    entityType: "SOURCE",
    entityId: source.id,
    locationRole: location.role,
    label: source.name || "Untitled source",
    placeId: location.placeId,
    placeName: location.placeName || place.canonicalName,
    latitude: place.latitude,
    longitude: place.longitude,
    thumbnailUrl: thumbnail?.thumbnailUrl || thumbnail?.url || null,
    path: `/library/source/${encodeURIComponent(source.id)}`,
  });
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

async function placeFor(value: Located, resolvePlace: PlaceResolver) {
  return value.locationPlaceId ? resolvePlace(value.locationPlaceId) : null;
}

async function inBatches<TInput, TResult>(
  values: readonly TInput[],
  batchSize: number,
  load: (value: TInput) => Promise<TResult>,
): Promise<PromiseSettledResult<TResult>[]> {
  const results: PromiseSettledResult<TResult>[] = [];
  for (let offset = 0; offset < values.length; offset += batchSize) {
    results.push(
      ...(await Promise.allSettled(
        values.slice(offset, offset + batchSize).map(load),
      )),
    );
  }
  return results;
}

function marker(value: Omit<OwnedMapMarker, "key">): OwnedMapMarker {
  return {
    ...value,
    key: `${value.entityType}:${value.entityId}:${value.locationRole}`,
  };
}

function profileLabel(profile: Profile): string {
  const fullName = [profile.firstName, profile.lastName]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
  return profile.nickName?.trim() || fullName || "Unnamed profile";
}

function uniqueById<T extends { id: string | number }>(values: T[]): T[] {
  return Array.from(
    new Map(values.map((value) => [String(value.id), value])).values(),
  );
}
