import { doFetch } from '../util/Fetcher';

type JsonRecord = Record<string, unknown>;
type RequestOptions = RequestInit & {
  headers?: HeadersInit;
};

type CurrentUserInfo = {
  currentUserId: unknown | null;
  oauthProfile: JsonRecord | null;
};

type ProfileHandlers = {
  onSuccess: (data: any) => void;
  onMissing?: () => void;
  onEmpty?: () => void;
  onError?: () => void;
};

function requestJson(url: string, options: RequestOptions = {}) {
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
}

export function fetchCurrentUserInfo(onResult: (result: CurrentUserInfo) => void): void {
  doFetch('/api/user/oauth/me', 'GET', null, {
    200: profile => {
      const data = (profile || {}) as JsonRecord;
      onResult({ currentUserId: data.userId || null, oauthProfile: data || null });
    },
    401: () => onResult({ currentUserId: null, oauthProfile: null }),
    404: () => onResult({ currentUserId: null, oauthProfile: null }),
    default: () => onResult({ currentUserId: null, oauthProfile: null }),
  });
}

export function fetchProfileById(id: string | number | null | undefined, handlers: ProfileHandlers): void {
  const url = id ? `/api/profile/profile/${id}` : '/api/profile/profile';
  doFetch(url, 'GET', null, {
    200: profile => handlers.onSuccess(profile),
    404: () => handlers.onMissing?.(),
  });
}

export function fetchAvatar(profileId: string | number, handlers: ProfileHandlers): void {
  doFetch(`/api/image/image/profile/${profileId}`, 'GET', null, {
    200: avatars => {
      if (Array.isArray(avatars) && avatars.length) {
        handlers.onSuccess(avatars[0]);
        return;
      }
      handlers.onEmpty?.();
    },
    404: () => handlers.onEmpty?.(),
    500: () => handlers.onEmpty?.(),
    503: () => handlers.onEmpty?.(),
    default: () => handlers.onEmpty?.(),
  });
}

export function fetchClubProfiles(userId: string | number, handlers: ProfileHandlers): void {
  doFetch(`/api/profile/club-profile?userId=${userId}`, 'GET', null, {
    200: profiles => handlers.onSuccess(Array.isArray(profiles) ? profiles : []),
    default: () => handlers.onError?.(),
  });
}

export function fetchOwnerUserProfile(userId: string | number, handlers: ProfileHandlers): void {
  doFetch(`/api/profile/user-profile?userId=${userId}`, 'GET', null, {
    200: profile => handlers.onSuccess(profile || null),
    default: () => handlers.onError?.(),
  });
}

export function createUserProfile(event: { target: HTMLFormElement }, handlers: Record<string | number, (data?: unknown) => unknown>): void {
  doFetch('/api/profile/user-profile', 'POST', event, handlers);
}

export function createClubProfile(event: { target: HTMLFormElement }, handlers: Record<string | number, (data?: unknown) => unknown>): void {
  doFetch('/api/profile/club-profile', 'POST', event, handlers);
}

export function updateProfile(profileId: string | number, payload: JsonRecord) {
  return requestJson(`/api/profile/profile/${profileId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteProfile(profileId: string | number) {
  return requestJson(`/api/profile/profile/${profileId}`, {
    method: 'DELETE',
  });
}

export function uploadAvatar(profileId: string | number, payload: JsonRecord) {
  return requestJson(`/api/profile/profile/${profileId}/avatar`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAvatarDescription(profileId: string | number, description: string) {
  return requestJson(`/api/profile/profile/${profileId}/avatar/description`, {
    method: 'PUT',
    body: JSON.stringify({ description }),
  });
}

export function deleteAvatar(profileId: string | number) {
  return requestJson(`/api/profile/profile/${profileId}/avatar`, {
    method: 'DELETE',
  });
}
