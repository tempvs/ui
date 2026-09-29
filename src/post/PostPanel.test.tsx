import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import PostPanel from "./PostPanel";
import { fetchCurrentUserInfo, getUserProfileByUserId } from "../profile/profileApi";

jest.mock("../profile/profileApi", () => ({
  fetchCurrentUserInfo: jest.fn(),
  getUserProfileByUserId: jest.fn(),
}));

const mock = <T extends (...args: any[]) => any>(fn: T) => fn as jest.MockedFunction<T>;
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

beforeEach(() => {
  jest.resetAllMocks();
  mock(fetchCurrentUserInfo).mockImplementation(callback => callback({ currentUserId: "user-1", oauthProfile: null }));
  mock(getUserProfileByUserId).mockResolvedValue({ id: "profile-1", alias: "alex", firstName: "Alex", lastName: "Archer" });
  global.fetch = jest.fn().mockResolvedValue(response({ content: [{
    id: "post-1", authorUserId: "user-1", content: "Original post", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
  }] }));
});

test("renders clickable post authors and lets authors edit posts", async () => {
  render(<MemoryRouter><PostPanel targetType="PROFILE" targetId="profile-1" canCreate /></MemoryRouter>);

  expect(await screen.findByRole("link", { name: "Alex Archer" })).toHaveAttribute("href", "/profile/alex");
  expect(screen.getByText("Edited")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Publish post" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Post" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Edit post" }));
  fireEvent.change(screen.getByDisplayValue("Original post"), { target: { value: "Updated post" } });
  fireEvent.click(screen.getByRole("button", { name: "Save post" }));

  await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith(
    "/api/post/posts/post-1",
    expect.objectContaining({ method: "PUT", body: JSON.stringify({ content: "Updated post" }) }),
  ));
});
