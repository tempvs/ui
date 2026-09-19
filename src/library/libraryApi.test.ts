import { findSources, getAdminRoleRequests, patchSourceField, removeSource, createSource } from './libraryApi';

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
  } as Response;
}

afterEach(() => jest.restoreAllMocks());

test('Library search and admin lists use opaque cursor envelopes', async () => {
  const fetchMock = jest.spyOn(window, 'fetch')
    .mockResolvedValueOnce(response({ content: [{ id: 'source-uuid', version: 1 }], nextToken: 'next-source' }))
    .mockResolvedValueOnce(response({ roleRequests: [{ userId: '12', role: 'ROLE_CONTRIBUTOR' }], nextToken: 'next-request' }));

  const sources = await findSources({ query: 'cloth', size: 20 });
  const requests = await getAdminRoleRequests({ size: 20, nextToken: 'cursor-1' });

  expect(sources.data?.[0].id).toBe('source-uuid');
  expect(sources.nextToken).toBe('next-source');
  expect(String(fetchMock.mock.calls[0][0])).toContain('limit=20');
  expect(String(fetchMock.mock.calls[0][0])).not.toContain('page=');
  expect(requests.data?.nextToken).toBe('next-request');
  expect(String(fetchMock.mock.calls[1][0])).toContain('nextToken=cursor-1');
});

test('source writes send idempotency and optimistic version headers', async () => {
  const fetchMock = jest.spyOn(window, 'fetch')
    .mockResolvedValueOnce(response({ id: 'source-uuid', version: 1 }, 201))
    .mockResolvedValueOnce(response({ id: 'source-uuid', version: 2 }))
    .mockResolvedValueOnce(response({ id: 'job-uuid', state: 'PENDING' }, 202));

  await createSource({ name: 'Example', classification: 'OTHER', type: 'WRITTEN', period: 'MODERN' });
  await patchSourceField('source-uuid', 'name', 'Renamed', 1);
  await removeSource('source-uuid', 2);

  expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Idempotency-Key')).toBeTruthy();
  expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('If-Match')).toBe('"1"');
  expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get('If-Match')).toBe('"2"');
});
