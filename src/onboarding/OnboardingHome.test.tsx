import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import OnboardingHome from "./OnboardingHome";

jest.mock("../profile/profileApi", () => ({
  getUserProfileByUserId: jest.fn().mockResolvedValue({ id: "user-profile", type: "USER" }),
  getClubProfiles: jest.fn().mockResolvedValue([]),
  getFollowingProfiles: jest.fn().mockResolvedValue([]),
  getOnboardingPreferences: jest.fn().mockResolvedValue({ dismissedAt: null }),
  getOnboardingStatus: jest.fn().mockRejectedValue(new Error("not deployed")),
  markOnboardingCelebrated: jest.fn().mockResolvedValue({ dismissedAt: null, celebratedAt: null }),
  setOnboardingDismissed: jest.fn().mockResolvedValue({ dismissedAt: null }),
}));
jest.mock("../profile/stashApi", () => ({
  getProfileStash: jest.fn(),
  getGroupItemsByIds: jest.fn().mockResolvedValue(new Map()),
}));
jest.mock("../club/clubApi", () => ({
  getFollowedClubs: jest.fn().mockResolvedValue([]),
  getProfileClubs: jest.fn().mockResolvedValue([]),
}));
jest.mock("../event/eventApi", () => ({
  getFollowedEvents: jest.fn().mockResolvedValue({ content: [] }),
  getParticipatingEvents: jest.fn().mockResolvedValue({ content: [] }),
}));
jest.mock("../wall/WallPage", () => () => <div>Your wall</div>);

beforeEach(() => {
  window.localStorage.clear();
  const profileApi = jest.requireMock("../profile/profileApi") as Record<string, jest.Mock>;
  const stashApi = jest.requireMock("../profile/stashApi") as Record<string, jest.Mock>;
  const clubApi = jest.requireMock("../club/clubApi") as Record<string, jest.Mock>;
  const eventApi = jest.requireMock("../event/eventApi") as Record<string, jest.Mock>;
  Object.values(profileApi).forEach((mock) => mock.mockReset());
  Object.values(stashApi).forEach((mock) => mock.mockReset());
  Object.values(clubApi).forEach((mock) => mock.mockReset());
  Object.values(eventApi).forEach((mock) => mock.mockReset());
  profileApi.getUserProfileByUserId.mockResolvedValue({ id: "user-profile", type: "USER" });
  profileApi.getClubProfiles.mockResolvedValue([]);
  profileApi.getFollowingProfiles.mockResolvedValue([]);
  profileApi.getOnboardingPreferences.mockResolvedValue({ dismissedAt: null });
  profileApi.getOnboardingStatus.mockRejectedValue(new Error("not deployed"));
  profileApi.markOnboardingCelebrated.mockResolvedValue({ dismissedAt: null, celebratedAt: null });
  profileApi.setOnboardingDismissed.mockResolvedValue({ dismissedAt: null });
  stashApi.getProfileStash.mockResolvedValue({ groups: [] });
  stashApi.getGroupItemsByIds.mockResolvedValue(new Map());
  clubApi.getFollowedClubs.mockResolvedValue([]);
  clubApi.getProfileClubs.mockResolvedValue([]);
  eventApi.getFollowedEvents.mockResolvedValue({ content: [] });
  eventApi.getParticipatingEvents.mockResolvedValue({ content: [] });
});

test("shows the guided journey and does not treat an empty profile as ready", async () => {
  render(
    <MemoryRouter>
      <OnboardingHome userId="user-1" />
    </MemoryRouter>,
  );

  expect(await screen.findByText("Bring your history to life")).toBeInTheDocument();
  expect(screen.getByText("0 of 4", { exact: false })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Create a profile" })).toHaveAttribute("href", "/profile?returnTo=%2F");
  expect(screen.queryByText("Your wall")).not.toBeInTheDocument();
});

test("hands an established member to the regular wall", async () => {
  const profileApi = jest.requireMock("../profile/profileApi") as {
    getClubProfiles: jest.Mock;
    getFollowingProfiles: jest.Mock;
  };
  const stashApi = jest.requireMock("../profile/stashApi") as {
    getProfileStash: jest.Mock;
    getGroupItemsByIds: jest.Mock;
  };
  profileApi.getClubProfiles.mockResolvedValue([{ id: "persona-1", type: "CLUB" }]);
  profileApi.getFollowingProfiles.mockResolvedValueOnce([{ id: "followed-profile" }]);
  stashApi.getProfileStash.mockResolvedValueOnce({ groups: [{ id: "group-1" }] });
  stashApi.getGroupItemsByIds.mockResolvedValueOnce(
    new Map([["group-1", [{ id: "item-1", sources: ["source-1"] }]]]),
  );

  render(
    <MemoryRouter>
      <OnboardingHome userId="user-2" />
    </MemoryRouter>,
  );

  await waitFor(() => expect(screen.getByText("Your wall")).toBeInTheDocument());
});

test("setup query resumes the guide after it was dismissed", async () => {
  const profileApi = jest.requireMock("../profile/profileApi") as Record<string, jest.Mock>;
  profileApi.getOnboardingPreferences.mockResolvedValue({ dismissedAt: "2026-11-03T00:00:00.000Z" });
  profileApi.getOnboardingStatus.mockResolvedValue({
    personaCount: 0,
    itemCount: 0,
    sourcedItemCount: 0,
    connectionCount: 0,
  });

  render(
    <MemoryRouter initialEntries={["/?setup=1"]}>
      <OnboardingHome userId="user-3" />
    </MemoryRouter>,
  );

  expect(await screen.findByText("Bring your history to life")).toBeInTheDocument();
  expect(profileApi.setOnboardingDismissed).toHaveBeenCalledWith(false);
});
