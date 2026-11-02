import { getProfileClubs } from "../club/clubApi";
import { getSource, getSourcesByIds } from "../library/libraryApi";
import { getImageThumbnails } from "../image/imageApi";
import {
  getClubProfiles,
  getProfilesByIds,
  getUserProfileByUserId,
} from "../profile/profileApi";
import { getGroupItemsByIds, getProfileStash } from "../profile/stashApi";
import { getEvent } from "../event/eventApi";
import {
  getMapPlacesByReference,
  getMapProjection,
  getMapProjections,
} from "./mapApi";
import {
  loadClubRelatedMapContent,
  loadOwnedMapContent,
  loadProfileRelatedMapContent,
  loadSourceRelatedMapContent,
  loadSharedMapScope,
} from "./ownedMapContent";

jest.mock("../club/clubApi", () => ({
  getProfileClubs: jest.fn(),
}));
jest.mock("../library/libraryApi", () => ({
  getSource: jest.fn(),
  getSourcesByIds: jest.fn(),
}));
jest.mock("../image/imageApi", () => ({ getImageThumbnails: jest.fn() }));
jest.mock("../profile/profileApi", () => ({
  getClubProfiles: jest.fn(),
  getProfilesByIds: jest.fn(),
  getUserProfileByUserId: jest.fn(),
  fetchProfileById: jest.fn(),
}));
jest.mock("../profile/stashApi", () => ({
  getGroupItemsByIds: jest.fn(),
  getProfileStash: jest.fn(),
}));
jest.mock("../event/eventApi", () => ({ getEvent: jest.fn() }));
jest.mock("./mapApi", () => ({
  getMapPlacesByReference: jest.fn(),
  getMapProjection: jest.fn(),
  getMapProjections: jest.fn(),
}));

const place = {
  id: "rome",
  canonicalName: "Rome",
  latitude: 41.9,
  longitude: 12.5,
  featureType: "SETTLEMENT",
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getUserProfileByUserId).mockResolvedValue({
    id: "personal",
    firstName: "Antonius",
    lastName: "Primvs",
    locationPlaceId: "rome",
    location: "Roma",
  });
  jest.mocked(getClubProfiles).mockResolvedValue([
    {
      id: "club-profile",
      type: "CLUB",
      nickName: "Legio",
      locationPlaceId: "rome",
    },
  ]);
  jest.mocked(getProfilesByIds).mockResolvedValue([
    { id: "personal", alias: "albvs" },
  ]);
  jest.mocked(getProfileClubs).mockResolvedValue([
    {
      id: "club",
      name: "Legio XXII",
      locationPlaceId: "rome",
      location: "Roma",
      photoThumbnailUrl: "https://images.test/club-thumb.jpg",
    } as never,
  ]);
  jest.mocked(getProfileStash).mockResolvedValue({
    groups: [{ id: "stash-group" }],
  });
  jest.mocked(getGroupItemsByIds).mockResolvedValue(
    new Map([["stash-group", [{ id: "item", sources: ["source"] } as never]]]),
  );
  jest.mocked(getSource).mockResolvedValue({ ok: false, status: 404, data: null });
  jest.mocked(getSourcesByIds).mockResolvedValue([
    {
      id: "source",
      version: 1,
      name: "Roman find",
      discoveredAtPlaceId: "rome",
      discoveredAtPlaceName: "Roma",
      heldAtPlaceId: "rome",
      heldAtPlaceName: "Roma",
    },
  ]);
  jest.mocked(getImageThumbnails).mockResolvedValue([
    {
      resourceType: "profile",
      resourceId: "personal",
      image: { thumbnailUrl: "https://images.test/profile-thumb.jpg" },
    },
    {
      resourceType: "club",
      resourceId: "club",
      image: { thumbnailUrl: "https://images.test/club-thumb.jpg" },
    },
    {
      resourceType: "source",
      resourceId: "source",
      image: { thumbnailUrl: "https://images.test/source-thumb.jpg" },
    },
    {
      resourceType: "event",
      resourceId: "event",
      image: { thumbnailUrl: "https://images.test/event.jpg" },
    },
  ]);
  jest.mocked(getMapPlacesByReference).mockImplementation(async (placeIds) =>
    new Map(placeIds.map((placeId) => [placeId, { ...place, id: placeId }])),
  );
  jest.mocked(getMapProjection).mockImplementation(async (scope, id) => {
    if (scope === "CLUB")
      return {
        scope, id, markers: [{
          entityType: "CLUB", entityId: id, locationRole: "CLUB_ASSOCIATION",
          label: "Legio XXII", placeId: "rome", placeName: "Roma", latitude: 41.9, longitude: 12.5,
        }], connections: [],
      };
    if (scope === "EVENT")
      return {
        scope, id, markers: [
          { entityType: "EVENT", entityId: id, locationRole: "VENUE", label: "Roman festival", placeId: "rome", placeName: "Roma", latitude: 41.9, longitude: 12.5 },
          { entityType: "EVENT", entityId: id, locationRole: "HISTORICAL_SITE", label: "Roman festival", placeId: "rome", placeName: "Roma", latitude: 41.9, longitude: 12.5 },
        ], connections: [],
      };
    if (scope === "SOURCE")
      return {
        scope, id, markers: [
          { entityType: "SOURCE", entityId: id, locationRole: "DISCOVERED_AT", label: "Roman find", placeId: "rome", placeName: "Roma", latitude: 41.9, longitude: 12.5 },
          { entityType: "SOURCE", entityId: id, locationRole: "HELD_AT", label: "Roman find", placeId: "museum", placeName: "Museum", latitude: 48.8, longitude: 2.3 },
        ], connections: [],
      };
    return {
      scope, id, markers: [
        { entityType: "PROFILE", entityId: id, locationRole: "CURRENT_RESIDENCE", label: "Antonius Primvs", placeId: "rome", placeName: "Roma", latitude: 41.9, longitude: 12.5 },
        { entityType: "CLUB", entityId: "club", locationRole: "CLUB_ASSOCIATION", label: "Legio XXII", placeId: "rome", placeName: "Roma", latitude: 41.9, longitude: 12.5 },
        { entityType: "SOURCE", entityId: "source", locationRole: "DISCOVERED_AT", label: "Roman find", placeId: "rome", placeName: "Roma", latitude: 41.9, longitude: 12.5 },
      ],
      connections: [
        { key: "profile-club", kind: "PROFILE_CLUB", fromKey: `PROFILE:${id}:CURRENT_RESIDENCE`, toKey: "CLUB:club:CLUB_ASSOCIATION" },
        { key: "profile-source", kind: "PROFILE_SOURCE", fromKey: `PROFILE:${id}:CURRENT_RESIDENCE`, toKey: "SOURCE:source:DISCOVERED_AT" },
      ],
    };
  });
  jest.mocked(getMapProjections).mockImplementation(async (_scope, ids) =>
    Promise.all(ids.map((id) => getMapProjection("PROFILE", id))),
  );
  jest.mocked(getEvent).mockResolvedValue({
    id: "event",
    name: "Roman festival",
    venuePlaceId: "rome",
    venuePlaceName: "Roma",
    historicalSitePlaceId: "rome",
    historicalSitePlaceName: "Roma",
    image: {
      id: "event-image",
      url: "https://images.test/event.jpg",
      description: null,
    },
  } as never);
});

test("composes profile, membership club, and club-stash source markers", async () => {
  const content = await loadOwnedMapContent("viewer");

  expect(content.markers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: "PROFILE:personal:CURRENT_RESIDENCE",
        thumbnailUrl: "https://images.test/profile-thumb.jpg",
        placeName: "Roma",
      }),
      expect.objectContaining({
        key: "CLUB:club:CLUB_ASSOCIATION",
        thumbnailUrl: "https://images.test/club-thumb.jpg",
      }),
      expect.objectContaining({
        key: "SOURCE:source:DISCOVERED_AT",
        path: "/library/source/source",
        thumbnailUrl: "https://images.test/source-thumb.jpg",
      }),
    ]),
  );
  expect(content.connections).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "PROFILE_CLUB",
        fromKey: "PROFILE:club-profile:CURRENT_RESIDENCE",
        toKey: "CLUB:club:CLUB_ASSOCIATION",
      }),
      expect.objectContaining({
        kind: "PROFILE_SOURCE",
        fromKey: "PROFILE:club-profile:CURRENT_RESIDENCE",
        toKey: "SOURCE:source:DISCOVERED_AT",
      }),
    ]),
  );
  // Persisted projections already carry their locations, so loading an owned
  // map does not need to resolve places individually.
  expect(getMapPlacesByReference).not.toHaveBeenCalled();
  expect(getSourcesByIds).not.toHaveBeenCalled();
  expect(getMapProjections).toHaveBeenCalledWith("PROFILE", [
    "personal",
    "club-profile",
  ]);
  expect(
    content.markers.filter((marker) => marker.entityId === "source"),
  ).toHaveLength(1);
});

test("uses one source marker when discovery and holding records resolve to one town", async () => {
  jest.mocked(getSourcesByIds).mockResolvedValue([
    {
      id: "source",
      version: 1,
      name: "Roman find",
      discoveredAtPlaceId: "rome-settlement",
      discoveredAtPlaceName: "Rome",
      heldAtPlaceId: "rome-historic-settlement",
      heldAtPlaceName: "Rome",
    },
  ]);

  const content = await loadOwnedMapContent("viewer");

  expect(
    content.markers.filter((marker) => marker.entityId === "source"),
  ).toEqual([expect.objectContaining({ key: "SOURCE:source:DISCOVERED_AT" })]);
});

test("uses discovery only for a source on the general owned map", async () => {
  jest.mocked(getSourcesByIds).mockResolvedValue([
    {
      id: "source",
      version: 1,
      name: "Roman find",
      discoveredAtPlaceId: "rome",
      discoveredAtPlaceName: "Rome",
      heldAtPlaceId: "museum",
      heldAtPlaceName: "Museum",
    },
  ]);
  jest.mocked(getMapPlacesByReference).mockImplementation(async (placeIds) =>
    new Map(placeIds.map((placeId) => [placeId, { ...place, id: placeId }])),
  );

  const content = await loadOwnedMapContent("viewer");

  expect(
    content.markers.filter((marker) => marker.entityId === "source"),
  ).toEqual([expect.objectContaining({ key: "SOURCE:source:DISCOVERED_AT" })]);
});

test("loads the club avatar when the club catalogue row has an image id but no signed URL", async () => {
  jest.mocked(getProfileClubs).mockResolvedValue([
    {
      id: "club",
      name: "Legio XXII",
      locationPlaceId: "rome",
      location: "Roma",
      photoImageId: "club-avatar",
    } as never,
  ]);
  jest.mocked(getImageThumbnails).mockResolvedValue([
    {
      resourceType: "club",
      resourceId: "club",
      image: { thumbnailUrl: "https://images.test/club-avatar.jpg" },
    },
  ]);

  const content = await loadOwnedMapContent("viewer");

  expect(content.markers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: "CLUB:club:CLUB_ASSOCIATION",
        thumbnailUrl: "https://images.test/club-avatar.jpg",
      }),
    ]),
  );
});

test("composes a bounded relationship overlay for a public profile page", async () => {
  const content = await loadProfileRelatedMapContent({
    id: "personal",
    firstName: "Antonius",
    lastName: "Primvs",
    locationPlaceId: "rome",
    location: "Roma",
  });

  expect(content.markers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: "PROFILE:personal:CURRENT_RESIDENCE" }),
      expect.objectContaining({ key: "CLUB:club:CLUB_ASSOCIATION" }),
      expect.objectContaining({ key: "SOURCE:source:DISCOVERED_AT" }),
    ]),
  );
  expect(content.connections).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "PROFILE_CLUB",
        fromKey: "PROFILE:personal:CURRENT_RESIDENCE",
        toKey: "CLUB:club:CLUB_ASSOCIATION",
      }),
      expect.objectContaining({
        kind: "PROFILE_SOURCE",
        fromKey: "PROFILE:personal:CURRENT_RESIDENCE",
        toKey: "SOURCE:source:DISCOVERED_AT",
      }),
    ]),
  );
});

test("renders a club scope as its single club location", async () => {
  const content = await loadClubRelatedMapContent({
    id: "club",
    name: "Legio XXII",
    locationPlaceId: "rome",
    location: "Roma",
    photoThumbnailUrl: "https://images.test/club-thumb.jpg",
  } as never);

  expect(content.markers).toEqual([
    expect.objectContaining({
      key: "CLUB:club:CLUB_ASSOCIATION",
      thumbnailUrl: "https://images.test/club-thumb.jpg",
    }),
  ]);
  expect(content.connections).toEqual([]);
});

test("connects both saved source locations without traversing a source page", async () => {
  const content = await loadSourceRelatedMapContent({ id: "source" } as never);

  expect(content.markers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: "SOURCE:source:DISCOVERED_AT" }),
      expect.objectContaining({ key: "SOURCE:source:HELD_AT" }),
    ]),
  );
  expect(content.connections).toEqual([
    expect.objectContaining({
      kind: "SOURCE_LOCATIONS",
      fromKey: "SOURCE:source:DISCOVERED_AT",
      toKey: "SOURCE:source:HELD_AT",
    }),
  ]);
});

test("resolves an event share scope to its public venue and historical-site pins", async () => {
  const content = await loadSharedMapScope({ type: "EVENT", id: "event" });

  expect(content.markers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: "EVENT:event:VENUE",
        path: "/events/event",
        thumbnailUrl: "https://images.test/event.jpg",
      }),
      expect.objectContaining({ key: "EVENT:event:HISTORICAL_SITE" }),
    ]),
  );
  expect(content.connections).toEqual([
    expect.objectContaining({
      kind: "EVENT_LOCATIONS",
      fromKey: "EVENT:event:VENUE",
      toKey: "EVENT:event:HISTORICAL_SITE",
    }),
  ]);
});

test("resolves a shared user scope from the original owner's id", async () => {
  const content = await loadSharedMapScope({ type: "USER", id: "owner-1" });

  expect(getUserProfileByUserId).toHaveBeenCalledWith("owner-1");
  expect(content.markers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: "PROFILE:personal:CURRENT_RESIDENCE" }),
      expect.objectContaining({ key: "CLUB:club:CLUB_ASSOCIATION" }),
      expect.objectContaining({ key: "SOURCE:source:DISCOVERED_AT" }),
    ]),
  );
  expect(content.connections).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "PROFILE_CLUB" }),
      expect.objectContaining({ kind: "PROFILE_SOURCE" }),
    ]),
  );
});

test("loads the owned map from persisted profile projections", async () => {
  let releaseClubReads: (() => void) | undefined;
  const waitForClubReads = new Promise<void>((resolve) => {
    releaseClubReads = resolve;
  });
  jest.mocked(getProfileClubs).mockImplementation(async () => {
    await waitForClubReads;
    return [];
  });
  jest.mocked(getProfileStash).mockImplementation(async () => {
    await waitForClubReads;
    return { groups: [] };
  });
  let publishFirstProgress: (() => void) | undefined;
  const firstProgress = new Promise<void>((resolve) => {
    publishFirstProgress = resolve;
  });
  const progress = jest.fn(() => publishFirstProgress?.());
  const contentPromise = loadOwnedMapContent("viewer", progress);

  await firstProgress;

  expect(progress).toHaveBeenCalledWith(
    expect.objectContaining({
    markers: expect.arrayContaining([
      expect.objectContaining({ key: "PROFILE:personal:CURRENT_RESIDENCE" }),
    ]),
    connections: expect.arrayContaining([
      expect.objectContaining({ kind: "PROFILE_SOURCE" }),
    ]),
    }),
  );

  releaseClubReads?.();
  await contentPromise;
});
