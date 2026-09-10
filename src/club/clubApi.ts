import { Id, Profile } from '../profile/profileTypes';
import { Period } from '../util/periods';

export type Club = {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  contactEmail: string | null;
  period: Period;
  creatorUserId: number;
  adminUserIds: number[];
  canManage: boolean;
  canManageAdmins: boolean;
  photoUrl?: string | null;
};
export type ClubDraft = Pick<Club, 'name' | 'description' | 'location' | 'contactEmail' | 'period'>;

export class ClubApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/club${path}`, {
    method,
    signal,
    headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw new ClubApiError(response.status, typeof data?.detail === 'string' ? data.detail : 'Unable to complete the club request. Please try again.');
  if (response.status !== 204 && data == null) {
    throw new ClubApiError(502, 'The club service returned an invalid response. Please try again.');
  }
  return data as T;
}

function invalidResponse(): never {
  throw new ClubApiError(502, 'The club service returned an unexpected response. Please try again.');
}

function clubValue(value: unknown): Club {
  const club = value as Club | null;
  if (!club || typeof club.id !== 'number' || typeof club.name !== 'string' || typeof club.period !== 'string'
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

function pageValue<T>(value: unknown, item: (value: unknown) => T): { content: T[]; hasMore: boolean } {
  // Allow responses from the previous service release during a rolling update.
  if (Array.isArray(value)) return { content: value.map(item), hasMore: value.length === 20 };
  const page = value as { content?: unknown; hasMore?: unknown } | null;
  if (!page || typeof page.hasMore !== 'boolean') return invalidResponse();
  return { content: arrayValue(page.content, item), hasMore: page.hasMore };
}

function profileValue(value: unknown): Profile {
  const profile = value as Profile | null;
  if (!profile || (typeof profile.id !== 'number' && typeof profile.id !== 'string')
      || ![profile.firstName, profile.lastName, profile.nickName, profile.alias, profile.period].every(text => text == null || typeof text === 'string')) return invalidResponse();
  return profile;
}

export type ClubPage = { content: Club[]; hasMore: boolean };
export const listClubs = async (query = '', period = '', page = 0, signal?: AbortSignal): Promise<ClubPage> => pageValue(await request<unknown>(`/clubs?${new URLSearchParams({ query, page: String(page), size: '20', ...(period ? { period } : {}) })}`, 'GET', undefined, signal), clubValue);
export const uploadClubPhoto = (id: Id, file: File) => {
  const body = new FormData(); body.append('file', file);
  return request<Club>(`/clubs/${id}/photo`, 'POST', body);
};
export const removeClubPhoto = (id: Id) => request<Club>(`/clubs/${id}/photo`, 'DELETE');
export const getClub = async (id: Id) => clubValue(await request<unknown>(`/clubs/${id}`));
export const createClub = (draft: ClubDraft) => request<Club>('/clubs', 'POST', draft);
export const updateClub = (id: Id, draft: ClubDraft) => request<Club>(`/clubs/${id}`, 'PUT', draft);
export const deleteClub = (id: Id) => request<void>(`/clubs/${id}`, 'DELETE');
export const getProfileClubs = async (id: Id) => arrayValue(await request<unknown>(`/profiles/${id}/clubs`), clubValue);
export type JoinOption = { club: Club; status: 'MEMBER' | 'PENDING' | 'REJECTED' | null };
export type JoinRequest = { id: number; clubId: number; profileId: number; status: 'PENDING' | 'ACCEPTED' | 'REJECTED'; requestedDate: string; profile: Profile | null };
export type JoinOptionsPage = { content: JoinOption[]; hasMore: boolean };
export const getJoinOptions = async (profileId: Id, query = '', page = 0, signal?: AbortSignal): Promise<JoinOptionsPage> => pageValue(await request<unknown>(`/profiles/${profileId}/join-options?${new URLSearchParams({ query, page: String(page), size: '20' })}`, 'GET', undefined, signal), value => {
  const option = value as JoinOption | null;
  if (!option || ![null, 'MEMBER', 'PENDING', 'REJECTED'].includes(option.status)) return invalidResponse();
  return { club: clubValue(option.club), status: option.status };
});
export const requestJoin = (clubId: Id, profileId: Id) => request<JoinRequest>(`/clubs/${clubId}/join-requests/${profileId}`, 'POST');
export const getJoinRequests = async (clubId: Id, page = 0) => arrayValue(await request<unknown>(`/clubs/${clubId}/join-requests?page=${page}&size=20`), value => {
  const item = value as JoinRequest | null;
  if (!item || typeof item.id !== 'number' || typeof item.profileId !== 'number') return invalidResponse();
  return { ...item, profile: item.profile == null ? null : profileValue(item.profile) };
});
export const decideJoinRequest = (clubId: Id, requestId: Id, decision: 'accept' | 'reject') => request<JoinRequest>(`/clubs/${clubId}/join-requests/${requestId}/${decision}`, 'POST');
export const getParticipants = async (id: Id, page = 0) => pageValue(await request<unknown>(`/clubs/${id}/participants?page=${page}&size=20`), profileValue);
export const attachProfile = (id: Id, profileId: Id) => request<void>(`/clubs/${id}/participants/${profileId}`, 'PUT');
export const detachProfile = (id: Id, profileId: Id) => request<void>(`/clubs/${id}/participants/${profileId}`, 'DELETE');
export const addAdmin = (id: Id, userId: Id) => request<Club>(`/clubs/${id}/admins/${userId}`, 'PUT');
export const removeAdmin = (id: Id, userId: Id) => request<Club>(`/clubs/${id}/admins/${userId}`, 'DELETE');
