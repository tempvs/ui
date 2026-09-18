import {
  activeProfileNotFoundId,
  createConversation,
  getConversation,
  listConversations,
  sendMessage,
} from './chatApi';

const PROFILE_2 = '01a0b18c-6042-74af-aa1f-f9f0e53038d1';
const PROFILE_3 = '01a0b18c-6042-74af-aa1f-fed4de174a27';

const conversation = {
  id: '0199f5d2-7a10-7000-8000-000000000001',
  type: 'DIRECT',
  displayName: 'Grace Hopper',
  previewText: 'Ada Lovelace: Hello',
  updatedAt: '2026-09-16T12:00:00.000Z',
  participants: [
    { profileId: PROFILE_2, name: 'Ada Lovelace', type: 'USER' },
    { profileId: PROFILE_3, name: 'Grace Hopper', type: 'USER' },
  ],
};

const details = {
  ...conversation,
  messages: [{
    id: '0199f5d2-7a10-7000-8000-000000000002',
    senderProfileId: PROFILE_2,
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

  await expect(listConversations(PROFILE_2, 'list-cursor')).resolves.toMatchObject({ hasMore: true });
  await expect(getConversation(conversation.id, PROFILE_2, 'message-cursor')).resolves.toMatchObject({
    id: conversation.id,
    hasMoreMessages: true,
  });

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    `/api/chat/conversations?profileId=${PROFILE_2}&limit=20&nextToken=list-cursor`,
    `/api/chat/conversations/${conversation.id}?profileId=${PROFILE_2}&limit=40&nextToken=message-cursor`,
  ]);
});

test('sends the caller-provided idempotency key for both writes', async () => {
  const fetchMock = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(response(details, 201))
    .mockResolvedValueOnce(response(details));

  await createConversation({ senderProfileId: PROFILE_2, participantProfileIds: [PROFILE_3] }, 'create-key');
  await sendMessage(conversation.id, { senderProfileId: PROFILE_2, text: 'Hello' }, 'send-key');

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

  await expect(listConversations(PROFILE_2)).rejects.toThrow('Bad request');
  await expect(listConversations(PROFILE_2)).rejects.toThrow('invalid response');
});

test('extracts a stale active profile id from the Chat API error', () => {
  expect(activeProfileNotFoundId(new Error(`Active profile ${PROFILE_2} not found`))).toBe(PROFILE_2);
  expect(activeProfileNotFoundId(new Error('Chat route not found'))).toBeNull();
});
