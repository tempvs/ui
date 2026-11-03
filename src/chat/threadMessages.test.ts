import {
  chatMessageKey,
  mergeThreadPage,
  receiptReaders,
} from "./threadMessages";
import type { ChatConversationDetails, ChatMessage } from "./chatTypes";

const message = (id: string): ChatMessage => ({
  id,
  senderProfileId: "sender",
  senderName: "Sender",
  text: id,
  createdAt: `2026-11-02T00:00:0${id}.000Z`,
});
const thread = {
  id: "chat",
  type: "GROUP",
  participants: [],
  messages: [message("1"), message("2")],
  hasMoreMessages: true,
  nextToken: "oldest-cursor",
  refreshToken: "after-two",
} as unknown as ChatConversationDetails;

test("newer pages retain loaded history and its older cursor without duplicating messages", () => {
  const result = mergeThreadPage(thread, {
    ...thread,
    messages: [message("2"), message("3")],
    nextToken: "wrong-newer-page-cursor",
    refreshToken: "after-three",
    hasMoreMessages: false,
  });
  expect(result.messages.map((value) => value.id)).toEqual(["1", "2", "3"]);
  expect(result.nextToken).toBe("oldest-cursor");
  expect(result.hasMoreMessages).toBe(true);
  expect(result.refreshToken).toBe("after-three");
});

test("an empty polling response keeps the forward cursor and all messages", () => {
  expect(
    mergeThreadPage(thread, {
      ...thread,
      messages: [],
      refreshToken: undefined,
    }),
  ).toMatchObject({ messages: thread.messages, refreshToken: "after-two" });
});

test("group receipt watermarks distinguish each recipient and always include the sender", () => {
  const state = {
    ...thread,
    readReceipts: [
      { profileId: "sender", unreadCount: 0, readThroughKey: "" },
      {
        profileId: "alice",
        unreadCount: 0,
        readThroughKey: chatMessageKey(message("3")),
      },
      {
        profileId: "bob",
        unreadCount: 2,
        readThroughKey: chatMessageKey(message("1")),
      },
    ],
  };
  expect(receiptReaders(message("2"), state)).toEqual(["sender", "alice"]);
  expect(receiptReaders(message("1"), state)).toEqual([
    "sender",
    "alice",
    "bob",
  ]);
});
