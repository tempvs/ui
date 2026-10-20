import {
  getClubImages,
  getParticipants,
  getProfileClubs,
} from "../club/clubApi";
import { getSource, getSourceImages } from "../library/libraryApi";
import {
  getClubProfiles,
  getProfileAvatar,
  getUserProfileByUserId,
} from "../profile/profileApi";
import { getGroupItems, getProfileStash } from "../profile/stashApi";
import { getEvent } from "../event/eventApi";
import { getMapPlace } from "./mapApi";
import {
  loadClubRelatedMapContent,
  loadOwnedMapContent,
  loadProfileRelatedMapContent,
  loadSharedMapScope,
} from "./ownedMapContent";

jest.mock("../club/clubApi", () => ({
  getClubImages: jest.fn(),
  getParticipants: jest.fn(),
  getProfileClubs: jest.fn(),
}));
jest.mock("../library/libraryApi", () => ({
  getSource: jest.fn(),
  getSourceImages: jest.fn(),
}));
jest.mock("../profile/profileApi", () => ({
  getClubProfiles: jest.fn(),
  getProfileAvatar: jest.fn(),
  getUserProfileByUserId: jest.fn(),
}));
jest.mock("../profile/stashApi", () => ({
  getGroupItems: jest.fn(),
  getProfileStash: jest.fn(),
}));
jest.mock("../event/eventApi", () => ({ getEvent: jest.fn() }));
jest.mock("./mapApi", () => ({ getMapPlace: jest.fn() }));

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
  jest.mocked(getProfileAvatar).mockResolvedValue({
    thumbnailUrl: "https://images.test/profile-thumb.jpg",
  });
  jest.mocked(getProfileClubs).mockResolvedValue([
    {
      id: "club",
      name: "Legio XXII",
      locationPlaceId: "rome",
      location: "Roma",
      photoThumbnailUrl: "https://images.test/club-thumb.jpg",
    } as never,
  ]);
  jest.mocked(getClubImages).mockResolvedValue([]);
  jest.mocked(getParticipants).mockResolvedValue({
    content: [
      {
        id: "member",
        nickName: "Member",
        locationPlaceId: "rome",
        location: "Roma",
      },
    ],
    hasMore: false,
  });
  jest.mocked(getProfileStash).mockResolvedValue({
    groups: [{ id: "stash-group" }],
  });
  jest
    .mocked(getGroupItems)
    .mockResolvedValue([{ id: "item", sources: ["source"] } as never]);
  jest.mocked(getSource).mockResolvedValue({
    ok: true,
    status: 200,
    data: {
      id: "source",
      version: 1,
      name: "Roman find",
      discoveredAtPlaceId: "rome",
      discoveredAtPlaceName: "Roma",
      heldAtPlaceId: "rome",
      heldAtPlaceName: "Roma",
    },
  });
  jest.mocked(getSourceImages).mockResolvedValue({
    ok: true,
    status: 200,
    data: [
      {
        id: "source-image",
        resourceId: "source",
        thumbnailUrl: "https://images.test/source-thumb.jpg",
      },
    ],
  });
  jest.mocked(getMapPlace).mockResolvedValue(place);
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
        fromKey: "PROFILE:personal:CURRENT_RESIDENCE",
        toKey: "CLUB:club:CLUB_ASSOCIATION",
      }),
      expect.objectContaining({
        kind: "PROFILE_SOURCE",
        fromKey: "PROFILE:club-profile:CURRENT_RESIDENCE",
        toKey: "SOURCE:source:DISCOVERED_AT",
      }),
      expect.objectContaining({
        kind: "USER_CLUB_PROFILE",
        fromKey: "PROFILE:personal:CURRENT_RESIDENCE",
        toKey: "PROFILE:club-profile:CURRENT_RESIDENCE",
      }),
    ]),
  );
  // Personal profile, club membership, and source all share Rome; the map
  // overlay must resolve that canonical place once instead of fanning out a
  // duplicate map request for every marker.
  expect(getMapPlace).toHaveBeenCalledTimes(1);
  expect(getSourceImages).toHaveBeenCalledTimes(1);
  expect(
    content.markers.filter((marker) => marker.entityId === "source"),
  ).toHaveLength(1);
});

test("uses one source marker when discovery and holding records resolve to one town", async () => {
  jest.mocked(getSource).mockResolvedValue({
    ok: true,
    status: 200,
    data: {
      id: "source",
      version: 1,
      name: "Roman find",
      discoveredAtPlaceId: "rome-settlement",
      discoveredAtPlaceName: "Rome",
      heldAtPlaceId: "rome-historic-settlement",
      heldAtPlaceName: "Rome",
    },
  });

  const content = await loadOwnedMapContent("viewer");

  expect(
    content.markers.filter((marker) => marker.entityId === "source"),
  ).toEqual([expect.objectContaining({ key: "SOURCE:source:DISCOVERED_AT" })]);
});

test("uses discovery only for a source on the general owned map", async () => {
  jest.mocked(getSource).mockResolvedValue({
    ok: true,
    status: 200,
    data: {
      id: "source",
      version: 1,
      name: "Roman find",
      discoveredAtPlaceId: "rome",
      discoveredAtPlaceName: "Rome",
      heldAtPlaceId: "museum",
      heldAtPlaceName: "Museum",
    },
  });
  jest.mocked(getMapPlace).mockImplementation(async (placeId) => ({
    ...place,
    id: placeId,
  }));

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
  jest.mocked(getClubImages).mockResolvedValue([
    {
      id: "club-avatar",
      thumbnailUrl: "https://images.test/club-avatar.jpg",
      status: "READY",
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

test("composes a bounded club-to-member overlay", async () => {
  const content = await loadClubRelatedMapContent({
    id: "club",
    name: "Legio XXII",
    locationPlaceId: "rome",
    location: "Roma",
    photoThumbnailUrl: "https://images.test/club-thumb.jpg",
  } as never);

  expect(content.markers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: "CLUB:club:CLUB_ASSOCIATION" }),
      expect.objectContaining({ key: "PROFILE:member:CURRENT_RESIDENCE" }),
    ]),
  );
  expect(content.connections).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "PROFILE_CLUB",
        fromKey: "PROFILE:member:CURRENT_RESIDENCE",
        toKey: "CLUB:club:CLUB_ASSOCIATION",
      }),
    ]),
  );
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
  expect(content.connections).toEqual([]);
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

test("publishes profile markers before optional club and source loading completes", async () => {
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

  expect(progress).toHaveBeenCalledWith({
    markers: expect.arrayContaining([
      expect.objectContaining({ key: "PROFILE:personal:CURRENT_RESIDENCE" }),
    ]),
    connections: [],
  });

  releaseClubReads?.();
  await contentPromise;
});
