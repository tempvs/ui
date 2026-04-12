import { doFetch } from '../util/Fetcher';

import {
  Avatar,
  CurrentUserInfo,
  Id,
  OauthProfile,
  Profile,
} from './profileTypes';

type JsonRecord = Record<string, unknown>;
type RequestOptions = RequestInit & {
  headers?: HeadersInit;
};

type ProfileHandlers<TData> = {
  onSuccess: (data: TData) => void;
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
      const data = (profile || {}) as OauthProfile;
      onResult({ currentUserId: data.userId || null, oauthProfile: data || null });
    },
    401: () => onResult({ currentUserId: null, oauthProfile: null }),
    404: () => onResult({ currentUserId: null, oauthProfile: null }),
    default: () => onResult({ currentUserId: null, oauthProfile: null }),
  });
}

export function fetchProfileById(id: Id | null | undefined, handlers: ProfileHandlers<Profile>): void {
  const url = id ? `/api/profile/profile/${id}` : '/api/profile/profile';
  doFetch(url, 'GET', null, {
    200: profile => handlers.onSuccess(profile as Profile),
    404: () => handlers.onMissing?.(),
  });
}

export function fetchAvatar(profileId: Id, handlers: ProfileHandlers<Avatar>): void {
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

export function fetchClubProfiles(userId: Id, handlers: ProfileHandlers<Profile[]>): void {
  doFetch(`/api/profile/club-profile?userId=${userId}`, 'GET', null, {
    200: profiles => handlers.onSuccess(Array.isArray(profiles) ? profiles : []),
    default: () => handlers.onError?.(),
  });
}

export function fetchOwnerUserProfile(userId: Id, handlers: ProfileHandlers<Profile | null>): void {
  doFetch(`/api/profile/user-profile?userId=${userId}`, 'GET', null, {
    200: profile => handlers.onSuccess((profile as Profile | null) || null),
    default: () => handlers.onError?.(),
  });
}

type FetchFormEvent = {
  currentTarget?: HTMLFormElement;
  target?: EventTarget | null;
};

export function createUserProfile(event: FetchFormEvent, handlers: Record<string | number, (data?: unknown) => unknown>): void {
  doFetch('/api/profile/user-profile', 'POST', event, handlers);
}

export function createClubProfile(event: FetchFormEvent, handlers: Record<string | number, (data?: unknown) => unknown>): void {
  doFetch('/api/profile/club-profile', 'POST', event, handlers);
}

export function updateProfile(profileId: Id, payload: JsonRecord) {
  return requestJson(`/api/profile/profile/${profileId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteProfile(profileId: Id) {
  return requestJson(`/api/profile/profile/${profileId}`, {
    method: 'DELETE',
  });
}

export function uploadAvatar(profileId: Id, payload: JsonRecord) {
  return requestJson(`/api/profile/profile/${profileId}/avatar`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAvatarDescription(profileId: Id, description: string | null) {
  return requestJson(`/api/profile/profile/${profileId}/avatar/description`, {
    method: 'PUT',
    body: JSON.stringify({ description }),
  });
}

export function deleteAvatar(profileId: Id) {
  return requestJson(`/api/profile/profile/${profileId}/avatar`, {
    method: 'DELETE',
  });
}
