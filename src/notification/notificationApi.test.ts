import {
  archiveNotification,
  getUnreadNotificationCount,
  listNotifications,
  readAllNotifications,
  readNotification,
} from './notificationApi';

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as Response;
}

afterEach(() => jest.restoreAllMocks());

test('notification API uses authenticated edge routes and mutation methods', async () => {
  const fetchMock = jest
    .spyOn(window, 'fetch')
    .mockResolvedValueOnce(response({ content: [], nextToken: 'next' }))
    .mockResolvedValueOnce(response({ count: 4 }))
    .mockResolvedValueOnce(response({ id: 'notice-1', readAt: '2026-10-02T12:00:00Z' }))
    .mockResolvedValueOnce(response({ marked: 3 }))
    .mockResolvedValueOnce(response(undefined, 204));

  await listNotifications('unread', 'cursor');
  await getUnreadNotificationCount();
  await readNotification('notice-1');
  await readAllNotifications();
  await archiveNotification('notice-1');

  expect(fetchMock.mock.calls.map(call => String(call[0]))).toEqual([
    '/api/notification?status=unread&limit=30&nextToken=cursor',
    '/api/notification/unread-count',
    '/api/notification/notice-1/read',
    '/api/notification/read-all',
    '/api/notification/notice-1',
  ]);
  expect(fetchMock.mock.calls.map(call => call[1]?.method || 'GET')).toEqual([
    'GET',
    'GET',
    'POST',
    'POST',
    'DELETE',
  ]);
});

test('notification API exposes service errors', async () => {
  jest.spyOn(window, 'fetch').mockResolvedValueOnce(response({ message: 'Sign in is required' }, 401));
  await expect(getUnreadNotificationCount()).rejects.toThrow('Sign in is required');
});
