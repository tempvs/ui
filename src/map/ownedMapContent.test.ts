import { getProfileClubs } from "../club/clubApi";
import { getSource, getSourceImages } from "../library/libraryApi";
import {
  getClubProfiles,
  getProfileAvatar,
  getUserProfileByUserId,
} from "../profile/profileApi";
import { getGroupItems, getProfileStash } from "../profile/stashApi";
import { getMapPlace } from "./mapApi";
import { loadOwnedMapContent } from "./ownedMapContent";

jest.mock("../club/clubApi", () => ({ getProfileClubs: jest.fn() }));
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
