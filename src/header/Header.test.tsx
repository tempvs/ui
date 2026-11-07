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
}));
jest.mock("../search/SearchDialog", () => () => null);
jest.mock("../chat/ChatButton", () => () => null);
jest.mock("../notification/NotificationButton", () => () => null);
jest.mock("../auth/LoginRegisterButton", () => () => null);
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
