import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import ChatThreadMessages from "./ChatThreadMessages";
import { getConversation, markConversationRead } from "./chatApi";
import type { ChatConversationDetails, ChatMessage } from "./chatTypes";
import { chatMessageKey } from "./threadMessages";

jest.mock("./chatApi", () => ({
  getConversation: jest.fn(),
  markConversationRead: jest.fn(),
}));
jest.mock("../map/MapReferenceAttachment", () => () => (
  <div>Map attachment</div>
));
const message = (index: number): ChatMessage => ({
  id: `m${index}`,
  senderProfileId: "other",
  senderName: "Other",
  text: `Message ${index}`,
  createdAt: `2026-11-02T00:00:0${index}.000Z`,
});
const details = (
  overrides: Partial<ChatConversationDetails> = {},
): ChatConversationDetails => ({
  id: "chat",
  type: "DIRECT",
  displayName: "Other",
  previewText: "",
  updatedAt: "",
  participants: [
    { profileId: "viewer", name: "Viewer", type: "USER" },
    { profileId: "other", name: "Other", type: "USER" },
  ],
  messages: [message(3), message(4), message(5)],
  hasMoreMessages: true,
  nextToken: "older",
  refreshToken: "after-five",
  firstUnreadMessageId: "m4",
  unreadCount: 2,
  readReceipts: [
    {
      profileId: "viewer",
      unreadCount: 2,
      readThroughKey: chatMessageKey(message(3)),
    },
  ],
  ...overrides,
});
function Host({ initial }: { initial: ChatConversationDetails }) {
  const [thread, setThread] = useState<ChatConversationDetails | null>(initial);
  return (
    thread && (
      <ChatThreadMessages
        conversation={thread}
        setConversation={setThread}
        profileId="viewer"
        scrollRequest={0}
        onRead={jest.fn()}
      />
    )
  );
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(document, "hasFocus").mockReturnValue(true);
  jest
    .spyOn(HTMLElement.prototype, "scrollHeight", "get")
    .mockImplementation(function (this: HTMLElement) {
      return this.querySelectorAll("[data-message-id]").length * 100;
    });
  jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
  jest
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      const parent = this.closest(".chat-message-list") as HTMLElement | null;
      const messages = parent
        ? Array.from(parent.querySelectorAll("[data-message-id]"))
        : [];
      const index = messages.indexOf(this);
      const top = index >= 0 ? index * 100 - (parent?.scrollTop || 0) : 0;
      const height = index >= 0 ? 100 : 200;
      return {
        top,
        bottom: top + height,
        height,
        left: 0,
        right: 500,
        width: 500,
        x: 0,
        y: top,
        toJSON() {},
      };
    });
  jest.mocked(markConversationRead).mockResolvedValue({
    unreadCount: 0,
    readThroughKey: chatMessageKey(message(5)),
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("opens at the earliest unread and acknowledges only visible incoming messages", async () => {
  render(<Host initial={details()} />);
  const list = screen.getByRole("log");
  expect(list.scrollTop).toBe(88);
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  expect(markConversationRead).toHaveBeenCalledWith(
    "chat",
    "viewer",
    expect.objectContaining({ id: "m5" }),
  );
  expect(screen.getByText("Unread messages")).toBeInTheDocument();
});

test("opens at the bottom when every message is read", () => {
  render(
    <Host
      initial={details({ firstUnreadMessageId: undefined, unreadCount: 0 })}
    />,
  );
  expect(screen.getByRole("log").scrollTop).toBe(300);
});

test("prepending older history preserves the visible message and pixel offset", async () => {
  jest.mocked(getConversation).mockResolvedValue(
    details({
      messages: [message(1), message(2)],
      hasMoreMessages: false,
      nextToken: undefined,
    }),
  );
  render(<Host initial={details()} />);
  fireEvent.click(screen.getByRole("button", { name: "Load older messages" }));
  await waitFor(() =>
    expect(screen.getByText("Message 1")).toBeInTheDocument(),
  );
  expect(screen.getByRole("log").scrollTop).toBe(288);
  expect(screen.getByText("Message 5")).toBeInTheDocument();
});

test("never marks a conversation read in a background tab", async () => {
  jest.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  render(<Host initial={details()} />);
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  expect(markConversationRead).not.toHaveBeenCalled();
});

test("does not download the unread backlog until the reader pages forward", async () => {
  render(<Host initial={details({ newerToken: "next-unread-page" })} />);
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  expect(getConversation).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Load newer messages" }),
  ).toBeInTheDocument();
});

test("polling appends messages without discarding history or pulling the reader to the bottom", async () => {
  jest.mocked(getConversation).mockResolvedValue(
    details({
      messages: [message(6)],
      firstUnreadMessageId: "m6",
      refreshToken: "after-six",
    }),
  );
  render(<Host initial={details()} />);
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  expect(screen.getByText("Message 3")).toBeInTheDocument();
  expect(screen.getByText("Message 6")).toBeInTheDocument();
  expect(screen.getByRole("log").scrollTop).toBe(88);
  expect(getConversation).toHaveBeenCalledWith("chat", "viewer", "after-five");
});
