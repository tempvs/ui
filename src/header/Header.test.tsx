import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import Header from "./Header";

jest.mock("../profile/profileApi", () => ({
  fetchCurrentUserInfo: jest.fn(),
  fetchUserProfileByUserId: jest.fn(),
  fetchClubProfiles: jest.fn(),
  getOnboardingStatus: jest.fn(),
  getOnboardingPreferences: jest.fn(),
  getProfileAvatar: jest.fn(),
}));
jest.mock("../search/SearchDialog", () => () => null);
jest.mock("../chat/ChatButton", () => () => null);
jest.mock("../notification/NotificationButton", () => () => null);
jest.mock("../profile/components/ProfilePicker", () => () => null);

const api = jest.requireMock("../profile/profileApi");
const complete = {
  personaCount: 1, itemCount: 6, sourcedItemCount: 6, connectionCount: 8, partial: false,
};
const incomplete = { ...complete, sourcedItemCount: 0 };
const reminder = "Your setup is still in progress. Select Home to continue.";

beforeEach(() => {
  jest.resetAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
  api.fetchCurrentUserInfo.mockImplementation((callback: Function) => callback({ currentUserId: "user-1" }));
  api.fetchUserProfileByUserId.mockImplementation((_id: string, callbacks: any) => callbacks.onSuccess({ id: "personal", type: "USER" }));
  api.fetchClubProfiles.mockImplementation((_id: string, callbacks: any) => callbacks.onSuccess([{ id: "persona", type: "CLUB" }]));
  api.getOnboardingStatus.mockResolvedValue(complete);
  api.getOnboardingPreferences.mockResolvedValue({ dismissedAt: null, celebratedAt: null });
  api.getProfileAvatar.mockResolvedValue(null);
});

async function mountHeader() {
  await act(async () => {
    render(<IntlProvider locale="en"><MemoryRouter initialEntries={["/profile/albvs"]}><Header /></MemoryRouter></IntlProvider>);
  });
}

test("a delayed profile lookup failure cannot override completed onboarding", async () => {
  let failLookup: () => void = () => undefined;
  api.fetchClubProfiles.mockImplementation((_id: string, callbacks: any) => {
    failLookup = callbacks.onError;
  });
  await mountHeader();
  await act(async () => failLookup());
  expect(screen.queryByText(reminder)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Home" })).not.toHaveClass("onboarding-attention-target");
  expect(screen.queryByText("Click this icon to navigate to your current profile.")).not.toBeInTheDocument();
});

test.each([
  { status: { ...incomplete, partial: true }, preferences: {} },
  { status: incomplete, preferences: { celebratedAt: "2026-11-06T00:00:00Z" } },
  { status: incomplete, preferences: { dismissedAt: "2026-11-06T00:00:00Z" } },
])("suppresses reminders for unavailable or previously finished/dismissed setup: %j", async ({ status, preferences }) => {
  api.getOnboardingStatus.mockResolvedValue(status);
  api.getOnboardingPreferences.mockResolvedValue(preferences);
  await mountHeader();
  expect(screen.queryByText(reminder)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Home" })).not.toHaveClass("onboarding-attention-target");
});

test("still guides an unfinished member and clears the hint when they finish", async () => {
  api.getOnboardingStatus.mockResolvedValueOnce(incomplete);
  await mountHeader();
  expect(screen.getByText(reminder)).toBeInTheDocument();
  await act(async () => { fireEvent(window, new Event("tempvs:onboarding-status-changed")); });
  expect(screen.queryByText(reminder)).not.toBeInTheDocument();
  // A later incomplete snapshot must not restart a completed journey.
  api.getOnboardingStatus.mockResolvedValue(incomplete);
  await act(async () => { fireEvent.focus(window); });
  expect(screen.queryByText(reminder)).not.toBeInTheDocument();
});

test("an older incomplete response cannot replace a newer complete response", async () => {
  let finishOldRead: (value: typeof incomplete) => void = () => undefined;
  api.getOnboardingStatus.mockReturnValueOnce(new Promise(resolve => { finishOldRead = resolve; }));
  await mountHeader();
  await act(async () => { fireEvent.focus(window); });
  await act(async () => finishOldRead(incomplete));
  expect(screen.queryByText(reminder)).not.toBeInTheDocument();
});

test("signed-out visitors see login instead of the account menu", async () => {
  api.fetchCurrentUserInfo.mockImplementation((callback: Function) => callback({ currentUserId: null }));
  await mountHeader();
  expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Account menu" })).not.toBeInTheDocument();
  expect(api.fetchUserProfileByUserId).not.toHaveBeenCalled();
});

test("Google members see their picture and name with logout inside the menu", async () => {
  api.fetchCurrentUserInfo.mockImplementation((callback: Function) => callback({
    currentUserId: "user-1", oauthProfile: { name: "Ada Lovelace", picture: "https://google.test/ada.jpg" },
  }));
  await mountHeader();
  expect(screen.queryByRole("button", { name: "Log in" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  const toggle = screen.getByRole("button", { name: "Account menu" });
  expect(toggle.querySelector("img")).toHaveAttribute("src", "https://google.test/ada.jpg");
  expect(toggle.querySelector("svg")).toBeNull();
  expect(api.getProfileAvatar).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(toggle); });
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Ada Lovelace")).toBeVisible();
  const logout = screen.getByRole("button", { name: "Log out" });
  expect(logout).toHaveAttribute("type", "submit");
  expect(logout.closest("form")).toHaveAttribute("method", "post");
  expect(logout.closest("form")).toHaveAttribute("action", "/auth/logout");
  await act(async () => { fireEvent.keyDown(toggle, { key: "Escape", code: "Escape" }); });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("password members use the personal profile thumbnail and name even with a persona selected", async () => {
  api.fetchCurrentUserInfo.mockImplementation((callback: Function) => callback({
    currentUserId: "user-1", oauthProfile: { email: "member@example.test" },
  }));
  api.fetchUserProfileByUserId.mockImplementation((_id: string, callbacks: any) => callbacks.onSuccess({
    id: "personal", type: "USER", firstName: "Grace", lastName: "Hopper", avatarUrl: "/full-size.jpg",
  }));
  api.getProfileAvatar.mockResolvedValue({ url: "/full-size.jpg", thumbnailUrl: "/thumbnail.jpg" });
  window.localStorage.setItem("TEMPVS_CURRENT_PROFILE", "profile:persona");
  await mountHeader();
  const toggle = screen.getByRole("button", { name: "Account menu" });
  expect(toggle.querySelector("img")).toHaveAttribute("src", "/thumbnail.jpg");
  expect(api.getProfileAvatar).toHaveBeenCalledWith("personal");
  await act(async () => { fireEvent.click(toggle); });
  expect(screen.getByText("Grace Hopper")).toBeVisible();
});

test("missing and broken pictures fall back to the member's initials", async () => {
  api.fetchUserProfileByUserId.mockImplementation((_id: string, callbacks: any) => callbacks.onSuccess({
    id: "personal", type: "USER", firstName: "Grace", lastName: "Hopper",
  }));
  await mountHeader();
  const toggle = screen.getByRole("button", { name: "Account menu" });
  expect(toggle).toHaveTextContent("GH");
  expect(toggle.querySelector("img")).toBeNull();
  api.getProfileAvatar.mockResolvedValue({ thumbnailUrl: "/broken.jpg" });
  await act(async () => { fireEvent(window, new Event("tempvs:owned-profiles-changed")); });
  fireEvent.error(toggle.querySelector("img")!);
  expect(toggle).toHaveTextContent("GH");
  expect(toggle.querySelector("img")).toBeNull();
});
