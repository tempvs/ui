import { addEventAdmin, applyForEvent, createEvent, decideClubApplication, decideEventApplication, deleteEvent, getEvent, listEvents, removeEventAdmin, updateEvent } from './eventApi';

const draft = {
  ownerProfileId: 'profile-1',
  name: 'Autumn muster',
  description: 'A gathering',
  periods: ['OTHER' as const],
  schedule: {
    kind: 'ONE_TIME' as const,
    startsAt: '2026-10-10T12:00:00.000Z',
    endsAt: '2026-10-10T15:00:00.000Z',
    timeZone: 'UTC',
  },
};

const item = {
  id: 'event-1',
  ...draft,
  adminProfileIds: [],
  image: null,
  isActive: true,
  createdAt: '2026-09-30T12:00:00.000Z',
  updatedAt: '2026-09-30T12:00:00.000Z',
  version: 1,
};

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body === undefined ? '' : JSON.stringify(body),
  } as Response;
}

beforeEach(() => jest.restoreAllMocks());

test('event CRUD targets the plural edge route and sends idempotency/version data', async () => {
  const fetchMock = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(response({ content: [item] }))
    .mockResolvedValueOnce(response(item))
    .mockResolvedValueOnce(response(item, 201))
    .mockResolvedValueOnce(response({ ...item, version: 2 }))
    .mockResolvedValueOnce(response(undefined, 204));

  await listEvents();
  await getEvent(item.id);
  await createEvent(draft);
  await updateEvent(item.id, draft, 1);
  await deleteEvent(item.id);

  expect(fetchMock.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
    ['/api/events', undefined],
    ['/api/events/event-1', undefined],
    ['/api/events', 'POST'],
    ['/api/events/event-1', 'PUT'],
    ['/api/events/event-1', 'DELETE'],
  ]);
  expect(fetchMock.mock.calls[2][1]?.headers).toEqual(expect.objectContaining({
    'Idempotency-Key': expect.any(String),
  }));
  expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual(expect.objectContaining({ version: 1 }));
});

test('event API exposes the service error message', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(response({ message: 'Event owner is invalid' }, 400));
  await expect(createEvent(draft)).rejects.toThrow('Event owner is invalid');
});

test('event admin mutations use event-scoped routes', async () => {
  const fetchMock = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(response({ ...item, adminProfileIds: ['profile-2'], version: 2 }))
    .mockResolvedValueOnce(response({ ...item, adminProfileIds: [], version: 3 }));
  await addEventAdmin(item.id, 'profile-2');
  await removeEventAdmin(item.id, 'profile-2');
  expect(fetchMock.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
    ['/api/events/event-1/admins', 'POST'],
    ['/api/events/event-1/admins/profile-2', 'DELETE'],
  ]);
});

test('club-profile participation sends the two-stage application data', async () => {
  const application = { id: 'app-1', eventId: item.id, occurrenceId: 'occ-1', applicantType: 'CLUB', profileId: 'profile-2', clubId: 'club-1', status: 'CLUB_PENDING', attendees: [] };
  const fetchMock = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(response(application, 201))
    .mockResolvedValueOnce(response({ ...application, status: 'PENDING' }))
    .mockResolvedValueOnce(response({ ...application, status: 'APPROVED' }));
  await applyForEvent(item.id, 'occ-1', 'profile-2', 'TENTATIVE', 'CLUB', 'club-1');
  await decideClubApplication(item.id, application.id, 'approve', 'reviewer-1');
  await decideEventApplication(item.id, application.id, 'approve');
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual(expect.objectContaining({ participationType: 'CLUB', clubId: 'club-1' }));
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    '/api/events/event-1/occurrences/occ-1/profile-applications',
    '/api/events/event-1/club-applications/app-1/approve',
    '/api/events/event-1/applications/app-1/approve',
  ]);
});
