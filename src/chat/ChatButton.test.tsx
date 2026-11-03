import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ChatButton from "./ChatButton";
import { getUnreadCount } from "./chatApi";

jest.mock("./chatApi", () => ({ getUnreadCount: jest.fn() }));
jest.mock(
  "../component/HeaderIconPopover",
  () =>
    ({ children }: { children: React.ReactNode }) => <>{children}</>,
);

test("shows the active participant count and refreshes it after a read event", async () => {
  jest.mocked(getUnreadCount).mockResolvedValueOnce(7).mockResolvedValueOnce(0);
  render(
    <MemoryRouter>
      <ChatButton to="/chat" profileId="profile-one" />
    </MemoryRouter>,
  );
  expect(await screen.findByLabelText("7 unread messages")).toBeInTheDocument();
  await act(async () => {
    window.dispatchEvent(new Event("tempvs:chat-unread-changed"));
  });
  expect(screen.queryByLabelText("7 unread messages")).not.toBeInTheDocument();
  expect(getUnreadCount).toHaveBeenCalledTimes(2);
});

test("clears the previous participant badge when switching profiles", async () => {
  jest.mocked(getUnreadCount).mockResolvedValueOnce(7).mockResolvedValueOnce(2);
  const view = render(
    <MemoryRouter>
      <ChatButton to="/chat" profileId="first" />
    </MemoryRouter>,
  );
  await screen.findByLabelText("7 unread messages");
  view.rerender(
    <MemoryRouter>
      <ChatButton to="/chat" profileId="second" />
    </MemoryRouter>,
  );
  expect(await screen.findByLabelText("2 unread messages")).toBeInTheDocument();
  expect(screen.queryByLabelText("7 unread messages")).not.toBeInTheDocument();
});
