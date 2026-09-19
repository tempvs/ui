import { searchLibrarySources } from './stashApi';

afterEach(() => jest.restoreAllMocks());

test('Stash source picker follows Library cursor pages without offset parameters', async () => {
  const fetchMock = jest.spyOn(window, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ content: [{ id: 'source-uuid' }], nextToken: 'cursor-2' }),
  } as Response);

  const page = await searchLibrarySources({ query: 'cloth', size: 20, nextToken: 'cursor-1' });

  expect(page.content[0].id).toBe('source-uuid');
  expect(page.nextToken).toBe('cursor-2');
  expect(String(fetchMock.mock.calls[0][0])).toContain('nextToken=cursor-1');
  expect(String(fetchMock.mock.calls[0][0])).not.toContain('page=');
  const url = new URL(String(fetchMock.mock.calls[0][0]), 'https://example.com');
  expect(JSON.parse(window.atob(url.searchParams.get('q') || '')).query).toBe('cloth');
});
