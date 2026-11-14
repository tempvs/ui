import { getWallTargets } from "./wallTargets";
import { getFollowedEvents, getParticipatingEvents } from "../event/eventApi";
import { getFollowedClubs, getProfileClubs } from "../club/clubApi";
import { getFollowingProfiles } from "../profile/profileApi";
import { getProfileStash, getGroupItems } from "../profile/stashApi";

jest.mock("../event/eventApi", () => ({
  getFollowedEvents: jest.fn(),
  getParticipatingEvents: jest.fn(),
}));
jest.mock("../club/clubApi", () => ({
  getFollowedClubs: jest.fn(),
  getProfileClubs: jest.fn(),
}));
jest.mock("../profile/profileApi", () => ({ getFollowingProfiles: jest.fn() }));
jest.mock("../profile/stashApi", () => ({
  getProfileStash: jest.fn(),
  getGroupItems: jest.fn(),
}));

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getFollowedEvents).mockResolvedValue({ content: [] });
  jest.mocked(getParticipatingEvents).mockResolvedValue({ content: [] });
  jest.mocked(getFollowedClubs).mockResolvedValue([]);
  jest.mocked(getProfileClubs).mockResolvedValue([]);
  jest.mocked(getFollowingProfiles).mockResolvedValue([]);
  jest.mocked(getProfileStash).mockResolvedValue({ groups: [] } as any);
});

test("follows all event pages and deduplicates collection source targets", async () => {
  jest
    .mocked(getFollowedEvents)
    .mockResolvedValueOnce({
      content: [{ id: "event-1" }],
      nextToken: "older",
    } as any)
    .mockResolvedValueOnce({ content: [{ id: "event-2" }] } as any);
  jest
    .mocked(getProfileStash)
    .mockResolvedValue({ groups: [{ id: "group" }] } as any);
  jest
    .mocked(getGroupItems)
    .mockResolvedValue([{ sources: ["source", "source"] }] as any);
  const result = await getWallTargets("profile");
  expect(getFollowedEvents).toHaveBeenLastCalledWith("profile", "older");
  expect(result.targets).toEqual(
    expect.arrayContaining([
      { type: "EVENT", id: "event-2", reason: "FOLLOWED_EVENT" },
      { type: "SOURCE", id: "source", reason: "SOURCE_USED" },
    ]),
  );
  expect(
    result.targets.filter((target) => target.type === "SOURCE"),
  ).toHaveLength(1);
  expect(result.incomplete).toBe(false);
});

test("limits concurrent collection reads while reading every group", async () => {
  jest
    .mocked(getProfileStash)
    .mockResolvedValue({
      groups: Array.from({ length: 12 }, (_, id) => ({ id })),
    } as any);
  let running = 0;
  let peak = 0;
  jest.mocked(getGroupItems).mockImplementation(async (id) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 1));
    running--;
    return [{ sources: [String(id)] }] as any;
  });
  const result = await getWallTargets("profile");
  expect(peak).toBe(4);
  expect(getGroupItems).toHaveBeenCalledTimes(12);
  expect(
    result.targets.filter((target) => target.type === "SOURCE"),
  ).toHaveLength(12);
});

test("reports a failed group while retaining successful groups", async () => {
  jest
    .mocked(getProfileStash)
    .mockResolvedValue({ groups: [{ id: "broken" }, { id: "good" }] } as any);
  jest
    .mocked(getGroupItems)
    .mockRejectedValueOnce(new Error("Unavailable"))
    .mockResolvedValueOnce([{ sources: ["source"] }] as any);
  const result = await getWallTargets("profile");
  expect(result.incomplete).toBe(true);
  expect(result.targets).toContainEqual({
    type: "SOURCE",
    id: "source",
    reason: "SOURCE_USED",
  });
});
