import {
  activeProfileNotFoundId,
  createConversation,
  getConversation,
  listConversations,
  sendMessage,
} from './chatApi';

const conversation = {
  id: '0199f5d2-7a10-7000-8000-000000000001',
  type: 'DIRECT',
  displayName: 'Grace Hopper',
  previewText: 'Ada Lovelace: Hello',
  updatedAt: '2026-09-16T12:00:00.000Z',
  participants: [
    { profileId: 2, name: 'Ada Lovelace', type: 'USER' },
    { profileId: 3, name: 'Grace Hopper', type: 'USER' },
  ],
};

const details = {
  ...conversation,
  messages: [{
    id: '0199f5d2-7a10-7000-8000-000000000002',
    senderProfileId: 2,
    senderName: 'Ada Lovelace',
    text: 'Hello',
    createdAt: '2026-09-16T12:00:00.000Z',
  }],
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

test('uses cursor pages and opaque conversation IDs for both reads', async () => {
  const fetchMock = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(response({ content: [conversation], hasMore: true, nextToken: 'next-list' }))
    .mockResolvedValueOnce(response({ ...details, hasMoreMessages: true, nextToken: 'next-messages' }));

  await expect(listConversations(2, 'list-cursor')).resolves.toMatchObject({ hasMore: true });
  await expect(getConversation(conversation.id, 2, 'message-cursor')).resolves.toMatchObject({
    id: conversation.id,
    hasMoreMessages: true,
  });

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    '/api/chat/conversations?profileId=2&limit=20&nextToken=list-cursor',
    `/api/chat/conversations/${conversation.id}?profileId=2&limit=40&nextToken=message-cursor`,
  ]);
});

test('sends the caller-provided idempotency key for both writes', async () => {
  const fetchMock = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(response(details, 201))
    .mockResolvedValueOnce(response(details));

  await createConversation({ senderProfileId: 2, participantProfileIds: [3] }, 'create-key');
  await sendMessage(conversation.id, { senderProfileId: 2, text: 'Hello' }, 'send-key');

  expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/chat/conversations', expect.objectContaining({
    method: 'POST',
    headers: expect.objectContaining({ 'Idempotency-Key': 'create-key' }),
  }));
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    `/api/chat/conversations/${conversation.id}/messages`,
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Idempotency-Key': 'send-key' }),
    }),
  );
});

test('surfaces Lambda errors and rejects malformed successful responses', async () => {
  jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(response({ code: 'INVALID_REQUEST', message: 'Bad request' }, 400))
    .mockResolvedValueOnce(response({ content: [], hasMore: 'no' }));

  await expect(listConversations(2)).rejects.toThrow('Bad request');
  await expect(listConversations(2)).rejects.toThrow('invalid response');
});

test('extracts a stale active profile id from the Chat API error', () => {
  expect(activeProfileNotFoundId(new Error('Active profile 8 not found'))).toBe(8);
  expect(activeProfileNotFoundId(new Error('Chat route not found'))).toBeNull();
});
