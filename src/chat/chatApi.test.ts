import {
  activeProfileNotFoundId,
  createConversation,
  getConversation,
  getUnreadCount,
  listConversations,
  markConversationRead,
  sendMessage,
} from "./chatApi";

const PROFILE_2 = "01a0b18c-6042-74af-aa1f-f9f0e53038d1";
const PROFILE_3 = "01a0b18c-6042-74af-aa1f-fed4de174a27";

const conversation = {
  id: "0199f5d2-7a10-7000-8000-000000000001",
  type: "DIRECT",
  displayName: "Grace Hopper",
  previewText: "Ada Lovelace: Hello",
  updatedAt: "2026-09-16T12:00:00.000Z",
  participants: [
    { profileId: PROFILE_2, name: "Ada Lovelace", type: "USER" },
    { profileId: PROFILE_3, name: "Grace Hopper", type: "USER" },
  ],
};

const details = {
  ...conversation,
  messages: [
    {
      id: "0199f5d2-7a10-7000-8000-000000000002",
      senderProfileId: PROFILE_2,
      senderName: "Ada Lovelace",
      text: "Hello",
      createdAt: "2026-09-16T12:00:00.000Z",
    },
  ],
  hasMoreMessages: false,
};

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

beforeEach(() => {
  jest.restoreAllMocks();
});

test("uses cursor pages and opaque conversation IDs for both reads", async () => {
  const fetchMock = jest
    .spyOn(global, "fetch")
    .mockResolvedValueOnce(
      response({
        content: [conversation],
        hasMore: true,
        nextToken: "next-list",
      }),
    )
    .mockResolvedValueOnce(
      response({
        ...details,
        hasMoreMessages: true,
        nextToken: "next-messages",
      }),
    );

  await expect(
    listConversations(PROFILE_2, "list-cursor"),
  ).resolves.toMatchObject({ hasMore: true });
  await expect(
    getConversation(conversation.id, PROFILE_2, "message-cursor"),
  ).resolves.toMatchObject({
    id: conversation.id,
    hasMoreMessages: true,
  });

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    `/api/chat/conversations?profileId=${PROFILE_2}&limit=20&nextToken=list-cursor`,
    `/api/chat/conversations/${conversation.id}?profileId=${PROFILE_2}&limit=40&nextToken=message-cursor`,
  ]);
});

test("sends the caller-provided idempotency key for both writes", async () => {
  const fetchMock = jest
    .spyOn(global, "fetch")
    .mockResolvedValueOnce(response(details, 201))
    .mockResolvedValueOnce(response(details));

  await createConversation(
    { senderProfileId: PROFILE_2, participantProfileIds: [PROFILE_3] },
    "create-key",
  );
  await sendMessage(
    conversation.id,
    { senderProfileId: PROFILE_2, text: "Hello" },
    "send-key",
  );

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "/api/chat/conversations",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Idempotency-Key": "create-key" }),
    }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    `/api/chat/conversations/${conversation.id}/messages`,
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Idempotency-Key": "send-key" }),
    }),
  );
});

test("surfaces Lambda errors and rejects malformed successful responses", async () => {
  jest
    .spyOn(global, "fetch")
    .mockResolvedValueOnce(
      response({ code: "INVALID_REQUEST", message: "Bad request" }, 400),
    )
    .mockResolvedValueOnce(response({ content: [], hasMore: "no" }));

  await expect(listConversations(PROFILE_2)).rejects.toThrow("Bad request");
  await expect(listConversations(PROFILE_2)).rejects.toThrow(
    "invalid response",
  );
});

test("extracts a stale active profile id from the Chat API error", () => {
  expect(
    activeProfileNotFoundId(new Error(`Active profile ${PROFILE_2} not found`)),
  ).toBe(PROFILE_2);
  expect(activeProfileNotFoundId(new Error("Chat route not found"))).toBeNull();
});

test("reads the lightweight unread total and acknowledges a specific message for the active participant", async () => {
  const readThroughKey = `MESSAGE#${details.messages[0].createdAt}#${details.messages[0].id}`;
  const fetchMock = jest
    .spyOn(global, "fetch")
    .mockResolvedValueOnce(response({ unreadCount: 7 }))
    .mockResolvedValueOnce(response({ unreadCount: 2, readThroughKey }));
  await expect(getUnreadCount(PROFILE_2)).resolves.toBe(7);
  await expect(
    markConversationRead(conversation.id, PROFILE_2, details.messages[0]),
  ).resolves.toEqual({ unreadCount: 2, readThroughKey });
  expect(fetchMock.mock.calls[0][0]).toBe(
    `/api/chat/unread?profileId=${PROFILE_2}`,
  );
  expect(fetchMock.mock.calls[1][0]).toBe(
    `/api/chat/conversations/${conversation.id}/read`,
  );
  expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({
    profileId: PROFILE_2,
    messageId: details.messages[0].id,
    createdAt: details.messages[0].createdAt,
  });
});

test("preserves both paging directions and independent participant receipts", async () => {
  const readReceipts = [
    {
      profileId: PROFILE_2,
      unreadCount: 3,
      readThroughKey: "MESSAGE#2026-09-15",
    },
    {
      profileId: PROFILE_3,
      unreadCount: 0,
      readThroughKey: "MESSAGE#2026-09-17",
    },
  ];
  jest
    .spyOn(global, "fetch")
    .mockResolvedValueOnce(
      response({
        ...details,
        nextToken: "older",
        newerToken: "newer",
        refreshToken: "after-last",
        firstUnreadMessageId: details.messages[0].id,
        readReceipts,
        messages: [
          {
            ...details.messages[0],
            isRead: false,
            readByProfileIds: [PROFILE_3],
          },
        ],
      }),
    );
  await expect(
    getConversation(conversation.id, PROFILE_2),
  ).resolves.toMatchObject({
    nextToken: "older",
    newerToken: "newer",
    refreshToken: "after-last",
    readReceipts,
    messages: [
      expect.objectContaining({ isRead: false, readByProfileIds: [PROFILE_3] }),
    ],
  });
});

test.each(["SOURCE", "CLUB", "EVENT", "PROFILE"] as const)(
  "preserves the original %s map scope when sending and reading a chat message",
  async (type) => {
    const mapReference = {
      latitude: 41.9,
      longitude: 12.5,
      radiusKm: 25,
      entityTypes: [type],
      scope: { type, id: "origin-resource" },
    };
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      response({
        ...details,
        messages: [{ ...details.messages[0], mapReference }],
      }),
    );
    const result = await sendMessage(
      conversation.id,
      {
        senderProfileId: PROFILE_2,
        text: "",
        mapReference,
      },
      `map-${type}`,
    );
    expect(
      JSON.parse(fetchMock.mock.calls[0][1]?.body as string).mapReference,
    ).toEqual(mapReference);
    expect(result.messages[0].mapReference).toEqual(mapReference);
  },
);
