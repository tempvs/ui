import { dismissWallItem, getWall } from './wallApi';

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => jest.restoreAllMocks());

test('requests the wall with repeated relationship targets and a cursor', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(response({ content: [], hasMore: false }));
  await getWall('profile 1', [
    { type: 'PROFILE', id: 'profile 1', reason: 'OWN_PROFILE' },
    { type: 'CLUB', id: 'club-1', reason: 'CLUB_MEMBER' },
  ], 'cursor');
  const url = new URL(String(fetchMock.mock.calls[0][0]), 'https://tempvs.test');
  expect(url.pathname).toBe('/api/wall');
  expect(url.searchParams.get('profileId')).toBe('profile 1');
  expect(url.searchParams.getAll('target')).toEqual(['PROFILE:profile 1:OWN_PROFILE', 'CLUB:club-1:CLUB_MEMBER']);
  expect(url.searchParams.get('nextToken')).toBe('cursor');
});

test('dismisses a wall item for the selected profile', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(response(undefined, 204));
  await dismissWallItem('profile-1', 'activity/1');
  expect(fetchMock).toHaveBeenCalledWith('/api/wall/items/activity%2F1?profileId=profile-1', expect.objectContaining({ method: 'DELETE' }));
});
