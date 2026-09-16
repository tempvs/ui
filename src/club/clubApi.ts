import { Id, Profile } from '../profile/profileTypes';
import { Period } from '../util/periods';

export type Club = {
  id: Id;
  name: string;
  description: string | null;
  location: string | null;
  contactEmail: string | null;
  period: Period;
  creatorUserId: number;
  adminUserIds: number[];
  canManage: boolean;
  canManageAdmins: boolean;
  hasPhoto?: boolean;
  photoImageId?: string | null;
  photoUrl?: string | null;
  photoThumbnailUrl?: string | null;
};
export type ClubDraft = Pick<Club, 'name' | 'description' | 'location' | 'contactEmail' | 'period'>;

export class ClubApiError extends Error {
  constructor(public status: number, message: string, public unavailable = false) { super(message); }
}

export function isClubServiceUnavailable(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'unavailable' in error
    && (error as { unavailable?: unknown }).unavailable === true;
}

export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
  additionalHeaders: Record<string, string> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/club${path}`, {
      method,
      signal,
      headers: {
        ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...additionalHeaders,
      },
      ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ClubApiError(0, '', true);
  }
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ClubApiError(0, '', true);
  }
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const message = typeof data?.message === 'string'
      ? data.message
      : typeof data?.detail === 'string' ? data.detail : '';
    throw new ClubApiError(response.status, message, response.status >= 500);
  }
  if (response.status !== 204 && data == null) {
    throw new ClubApiError(502, 'The club service returned an invalid response. Please try again.', true);
  }
  return data as T;
}

function invalidResponse(): never {
  throw new ClubApiError(502, 'The club service returned an unexpected response. Please try again.', true);
}

function clubValue(value: unknown): Club {
  const club = value as Club | null;
  if (!club || (typeof club.id !== 'number' && typeof club.id !== 'string')
      || typeof club.name !== 'string' || typeof club.period !== 'string'
      || !Array.isArray(club.adminUserIds) || !club.adminUserIds.every(id => typeof id === 'number')
      || typeof club.canManage !== 'boolean' || typeof club.canManageAdmins !== 'boolean'
      || ![club.description, club.location, club.contactEmail, club.photoUrl].every(text => text == null || typeof text === 'string')) {
    return invalidResponse();
  }
  return club;
}

function arrayValue<T>(value: unknown, item: (value: unknown) => T): T[] {
  if (!Array.isArray(value)) return invalidResponse();
  return value.map(item);
}

function pageValue<T>(value: unknown, item: (value: unknown) => T): { content: T[]; hasMore: boolean; nextToken?: string } {
  // Allow responses from the previous service release during a rolling update.
  if (Array.isArray(value)) return { content: value.map(item), hasMore: false };
  const page = value as { content?: unknown; hasMore?: unknown; nextToken?: unknown } | null;
  if (!page || typeof page.hasMore !== 'boolean') return invalidResponse();
  if (page.nextToken !== undefined && typeof page.nextToken !== 'string') return invalidResponse();
  return {
    content: arrayValue(page.content, item),
    hasMore: page.hasMore,
    ...(typeof page.nextToken === 'string' ? { nextToken: page.nextToken } : {}),
  };
}

function profileValue(value: unknown): Profile {
  const profile = value as Profile | null;
  if (!profile || (typeof profile.id !== 'number' && typeof profile.id !== 'string')
      || ![profile.firstName, profile.lastName, profile.nickName, profile.alias, profile.period].every(text => text == null || typeof text === 'string')) return invalidResponse();
  return profile;
}

export type ClubPage = { content: Club[]; hasMore: boolean; nextToken?: string };
export type ClubImage = {
  id: string;
  status: 'PENDING' | 'READY' | 'REJECTED';
  url?: string;
  thumbnailUrl?: string;
  processing?: { status: string; errorCode?: string };
};

type UploadIntentResponse = {
  club: Club;
  image: ClubImage;
  upload: {
    method: 'PUT';
    url: string;
    headers: Record<string, string>;
    expiresAt: string;
  };
};

function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `club-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const listClubs = async (query = '', period = '', nextToken?: string, signal?: AbortSignal): Promise<ClubPage> => pageValue(await request<unknown>(`/clubs?${new URLSearchParams({ query, limit: '20', ...(period ? { period } : {}), ...(nextToken ? { nextToken } : {}) })}`, 'GET', undefined, signal), clubValue);
export async function uploadClubPhoto(id: Id, file: File): Promise<Club> {
  const intent = await request<UploadIntentResponse>(`/clubs/${id}/photo`, 'POST', {
    fileName: file.name,
    contentType: file.type,
    byteSize: file.size,
  });
  const upload = await fetch(intent.upload.url, {
    method: intent.upload.method,
    headers: intent.upload.headers,
    body: file,
  });
  if (!upload.ok) {
    throw new ClubApiError(upload.status, 'The photo could not be uploaded to storage.');
  }
  const image = await waitForClubPhoto(id, intent.image.id);
  const club = clubValue(intent.club);
  return {
    ...club,
    hasPhoto: true,
    photoImageId: image.id,
    photoUrl: image.url || null,
    photoThumbnailUrl: image.thumbnailUrl || null,
  };
}

export const removeClubPhoto = async (id: Id) => clubValue(
  await request<unknown>(`/clubs/${id}/photo`, 'DELETE'),
);
export const getClub = async (id: Id) => clubValue(await request<unknown>(`/clubs/${id}`));
export const createClub = async (draft: ClubDraft) => clubValue(await request<unknown>(
  '/clubs', 'POST', draft, undefined, { 'Idempotency-Key': newIdempotencyKey() },
));
export const updateClub = async (id: Id, draft: ClubDraft) => clubValue(
  await request<unknown>(`/clubs/${id}`, 'PUT', draft),
);
export const deleteClub = (id: Id) => request<void>(`/clubs/${id}`, 'DELETE');
export const getProfileClubs = async (id: Id) => arrayValue(await request<unknown>(`/profiles/${id}/clubs`), clubValue);
export type JoinOption = { club: Club; status: 'MEMBER' | 'PENDING' | 'REJECTED' | null };
export type JoinRequest = { id: Id; clubId: Id; profileId: Id; status: 'PENDING' | 'ACCEPTED' | 'REJECTED'; requestedDate: string; profile: Profile | null };
export type JoinOptionsPage = { content: JoinOption[]; hasMore: boolean; nextToken?: string };
export type JoinRequestsPage = { content: JoinRequest[]; hasMore: boolean; nextToken?: string };
export type ParticipantsPage = { content: Profile[]; hasMore: boolean; nextToken?: string };
function joinRequestValue(value: unknown): JoinRequest {
  const item = value as JoinRequest | null;
  if (!item || (typeof item.id !== 'number' && typeof item.id !== 'string')
      || (typeof item.clubId !== 'number' && typeof item.clubId !== 'string')
      || (typeof item.profileId !== 'number' && typeof item.profileId !== 'string')
      || !['PENDING', 'ACCEPTED', 'REJECTED'].includes(item.status)
      || typeof item.requestedDate !== 'string') return invalidResponse();
  return { ...item, profile: item.profile == null ? null : profileValue(item.profile) };
}
export const getJoinOptions = async (profileId: Id, query = '', nextToken?: string, signal?: AbortSignal): Promise<JoinOptionsPage> => pageValue(await request<unknown>(`/profiles/${profileId}/join-options?${new URLSearchParams({ query, limit: '20', ...(nextToken ? { nextToken } : {}) })}`, 'GET', undefined, signal), value => {
  const option = value as JoinOption | null;
  if (!option || ![null, 'MEMBER', 'PENDING', 'REJECTED'].includes(option.status)) return invalidResponse();
  return { club: clubValue(option.club), status: option.status };
});
export const requestJoin = async (clubId: Id, profileId: Id) => joinRequestValue(
  await request<unknown>(`/clubs/${clubId}/join-requests/${profileId}`, 'POST'),
);
export const getJoinRequests = async (clubId: Id, nextToken?: string): Promise<JoinRequestsPage> => pageValue(await request<unknown>(`/clubs/${clubId}/join-requests?${new URLSearchParams({ limit: '20', ...(nextToken ? { nextToken } : {}) })}`), joinRequestValue);
export const decideJoinRequest = async (clubId: Id, requestId: Id, decision: 'accept' | 'reject') => joinRequestValue(
  await request<unknown>(`/clubs/${clubId}/join-requests/${requestId}/${decision}`, 'POST'),
);
export const getParticipants = async (id: Id, nextToken?: string): Promise<ParticipantsPage> => pageValue(await request<unknown>(`/clubs/${id}/participants?${new URLSearchParams({ limit: '20', ...(nextToken ? { nextToken } : {}) })}`), profileValue);
export const attachProfile = (id: Id, profileId: Id) => request<void>(`/clubs/${id}/participants/${profileId}`, 'PUT');
export const detachProfile = (id: Id, profileId: Id) => request<void>(`/clubs/${id}/participants/${profileId}`, 'DELETE');
export const addAdmin = async (id: Id, userId: Id) => clubValue(
  await request<unknown>(`/clubs/${id}/admins/${userId}`, 'PUT'),
);
export const removeAdmin = async (id: Id, userId: Id) => clubValue(
  await request<unknown>(`/clubs/${id}/admins/${userId}`, 'DELETE'),
);

async function waitForClubPhoto(clubId: Id, imageId: string): Promise<ClubImage> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch(
      `/api/images/club/${encodeURIComponent(String(clubId))}?limit=1&imageIds=${encodeURIComponent(imageId)}`,
    );
    if (!response.ok) throw new ClubApiError(response.status, 'The uploaded photo status is unavailable.');
    const page = await response.json() as { content?: ClubImage[] };
    const image = page.content?.[0];
    if (image?.status === 'READY' && image.url) return image;
    if (image?.status === 'REJECTED' || image?.processing?.status === 'REJECTED') {
      throw new ClubApiError(422, image.processing?.errorCode || 'The uploaded photo was rejected.');
    }
    await new Promise(resolve => window.setTimeout(resolve, 750));
  }
  throw new ClubApiError(504, 'The photo is still processing. Reload the page in a moment.');
}
