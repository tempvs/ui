import {
  ClubApiError,
  ClubDraft,
  addAdmin,
  attachProfile,
  createClub,
  decideJoinRequest,
  deleteClub,
  detachProfile,
  getClub,
  getJoinOptions,
  getJoinRequests,
  getParticipants,
  getProfileClubs,
  listClubs,
  removeAdmin,
  requestJoin,
  updateClub,
  uploadClubPhoto,
} from './clubApi';

const draft: ClubDraft = {
  name: 'Longbow Company',
  description: null,
  location: 'York',
  contactEmail: null,
  period: 'OTHER',
};

const uuidClub = {
  id: '0199f5d2-7a10-7000-8000-000000000001',
  name: draft.name,
  description: draft.description,
  location: draft.location,
  contactEmail: draft.contactEmail,
  period: draft.period,
  creatorUserId: 'user-1',
  adminUserIds: [],
  canManage: true,
  canManageAdmins: true,
  photoUrl: null,
  photoThumbnailUrl: null,
};

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  jest.restoreAllMocks();
});

test('club creation sends an idempotency key and accepts a UUID club id', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(response(uuidClub, 201));

  await expect(createClub(draft)).resolves.toEqual(uuidClub);

  expect(fetchMock).toHaveBeenCalledWith('/api/club/clubs', expect.objectContaining({
    method: 'POST',
    headers: expect.objectContaining({
      'Content-Type': 'application/json',
      'Idempotency-Key': expect.stringMatching(/^[A-Za-z0-9._:-]{8,128}$/),
    }),
  }));
});

test('club reads accept UUID ids returned by the migrated API', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(response(uuidClub));

  await expect(getClub(uuidClub.id)).resolves.toEqual(uuidClub);
});

test('API errors expose the Lambda message', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(response({
    code: 'INVALID_REQUEST',
    message: 'Idempotency-Key is required',
  }, 400));

  await expect(createClub(draft)).rejects.toEqual(expect.objectContaining<Partial<ClubApiError>>({
    status: 400,
    message: 'Idempotency-Key is required',
  }));
});

test('club photos use a JSON upload intent, direct S3 PUT, and readiness polling', async () => {
  const file = new File(['image bytes'], 'photo.png', { type: 'image/png' });
  const image = {
    id: '0199f5d2-7a10-7000-8000-000000000099',
    status: 'READY',
    url: 'https://read.example.com/photo',
    thumbnailUrl: 'https://read.example.com/thumbnail',
  } as const;
  const fetchMock = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(response({
      club: { ...uuidClub, hasPhoto: true, photoImageId: image.id, version: 2 },
      image: { ...image, status: 'PENDING', url: undefined, thumbnailUrl: undefined },
      upload: {
        method: 'PUT',
        url: 'https://upload.example.com/photo',
        headers: {
          'content-type': 'image/png',
          'x-amz-tagging': 'tempvs-state=upload',
        },
        expiresAt: '2026-09-16T12:05:00.000Z',
      },
    }, 201))
    .mockResolvedValueOnce(response(null, 200))
    .mockResolvedValueOnce(response({ content: [image], hasNext: false }));

  await expect(uploadClubPhoto(uuidClub.id, file)).resolves.toEqual({
    ...uuidClub,
    hasPhoto: true,
    photoImageId: image.id,
    photoUrl: image.url,
    photoThumbnailUrl: image.thumbnailUrl,
    version: 2,
  });

  expect(fetchMock.mock.calls[0]).toEqual([
    `/api/club/clubs/${uuidClub.id}/photo`,
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'photo.png',
        contentType: 'image/png',
        byteSize: file.size,
      }),
    }),
  ]);
  expect(fetchMock.mock.calls[1]).toEqual([
    'https://upload.example.com/photo',
    {
      method: 'PUT',
      headers: {
        'content-type': 'image/png',
        'x-amz-tagging': 'tempvs-state=upload',
      },
      body: file,
    },
  ]);
  expect(fetchMock.mock.calls[2]?.[0]).toBe(
    `/api/images/club/${uuidClub.id}?limit=1&imageIds=${image.id}`,
  );
  expect(fetchMock.mock.calls.some(([, options]) => options?.body instanceof FormData)).toBe(false);
});

test('every club page action targets the migrated API contract and uses cursor pagination', async () => {
  const joinRequest = {
    id: '0199f5d2-7a10-7000-8000-000000000099',
    clubId: uuidClub.id,
    profileId: 2,
    status: 'PENDING' as const,
    requestedDate: '2026-09-16T12:00:00.000Z',
    profile: null,
  };
  const fetchMock = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(response({ content: [uuidClub], hasMore: false }))
    .mockResolvedValueOnce(response({ content: [], hasMore: false }))
    .mockResolvedValueOnce(response({ content: [], hasMore: false }))
    .mockResolvedValueOnce(response([uuidClub]))
    .mockResolvedValueOnce(response(joinRequest, 201))
    .mockResolvedValueOnce(response({ content: [joinRequest], hasMore: false }))
    .mockResolvedValueOnce(response(joinRequest))
    .mockResolvedValueOnce(response(uuidClub))
    .mockResolvedValueOnce(response(null, 204))
    .mockResolvedValueOnce(response(null, 204))
    .mockResolvedValueOnce(response(null, 204))
    .mockResolvedValueOnce(response(uuidClub))
    .mockResolvedValueOnce(response(uuidClub));

  await listClubs('long', 'OTHER', 'clubs-cursor');
  await getJoinOptions(2, 'long', 'options-cursor');
  await getParticipants(uuidClub.id, 'participants-cursor');
  await getProfileClubs(2);
  await requestJoin(uuidClub.id, 2);
  await getJoinRequests(uuidClub.id, 'requests-cursor');
  await decideJoinRequest(uuidClub.id, joinRequest.id, 'accept');
  await updateClub(uuidClub.id, draft);
  await deleteClub(uuidClub.id);
  await attachProfile(uuidClub.id, 2);
  await detachProfile(uuidClub.id, 2);
  await addAdmin(uuidClub.id, 'user-3');
  await removeAdmin(uuidClub.id, 'user-3');

  expect(fetchMock.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
    ['/api/club/clubs?query=long&limit=20&period=OTHER&nextToken=clubs-cursor', 'GET'],
    ['/api/club/profiles/2/join-options?query=long&limit=20&nextToken=options-cursor', 'GET'],
    [`/api/club/clubs/${uuidClub.id}/participants?limit=20&nextToken=participants-cursor`, 'GET'],
    ['/api/club/profiles/2/clubs', 'GET'],
    [`/api/club/clubs/${uuidClub.id}/join-requests/2`, 'POST'],
    [`/api/club/clubs/${uuidClub.id}/join-requests?limit=20&nextToken=requests-cursor`, 'GET'],
    [`/api/club/clubs/${uuidClub.id}/join-requests/${joinRequest.id}/accept`, 'POST'],
    [`/api/club/clubs/${uuidClub.id}`, 'PUT'],
    [`/api/club/clubs/${uuidClub.id}`, 'DELETE'],
    [`/api/club/clubs/${uuidClub.id}/participants/2`, 'PUT'],
    [`/api/club/clubs/${uuidClub.id}/participants/2`, 'DELETE'],
    [`/api/club/clubs/${uuidClub.id}/admins/user-3`, 'PUT'],
    [`/api/club/clubs/${uuidClub.id}/admins/user-3`, 'DELETE'],
  ]);
});
