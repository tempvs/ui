import { doFetch } from '../util/Fetcher';

function requestJson(url, options = {}) {
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
}

export function fetchCurrentUserInfo(onResult) {
  doFetch('/api/user/oauth/me', 'GET', null, {
    200: profile => onResult({ currentUserId: profile?.userId || null, oauthProfile: profile || null }),
    401: () => onResult({ currentUserId: null, oauthProfile: null }),
    404: () => onResult({ currentUserId: null, oauthProfile: null }),
    default: () => onResult({ currentUserId: null, oauthProfile: null }),
  });
}

export function fetchProfileById(id, handlers) {
  const url = id ? `/api/profile/profile/${id}` : '/api/profile/profile';
  doFetch(url, 'GET', null, {
    200: profile => handlers.onSuccess(profile),
    404: () => handlers.onMissing?.(),
  });
}

export function fetchAvatar(profileId, handlers) {
  doFetch(`/api/image/image/profile/${profileId}`, 'GET', null, {
    200: avatars => {
      if (avatars?.length) {
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

export function fetchClubProfiles(userId, handlers) {
  doFetch(`/api/profile/club-profile?userId=${userId}`, 'GET', null, {
    200: profiles => handlers.onSuccess(Array.isArray(profiles) ? profiles : []),
    default: () => handlers.onError?.(),
  });
}

export function fetchOwnerUserProfile(userId, handlers) {
  doFetch(`/api/profile/user-profile?userId=${userId}`, 'GET', null, {
    200: profile => handlers.onSuccess(profile || null),
    default: () => handlers.onError?.(),
  });
}

export function createUserProfile(event, handlers) {
  doFetch('/api/profile/user-profile', 'POST', event, handlers);
}

export function createClubProfile(event, handlers) {
  doFetch('/api/profile/club-profile', 'POST', event, handlers);
}

export function updateProfile(profileId, payload) {
  return requestJson(`/api/profile/profile/${profileId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteProfile(profileId) {
  return requestJson(`/api/profile/profile/${profileId}`, {
    method: 'DELETE',
  });
}

export function uploadAvatar(profileId, payload) {
  return requestJson(`/api/profile/profile/${profileId}/avatar`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAvatarDescription(profileId, description) {
  return requestJson(`/api/profile/profile/${profileId}/avatar/description`, {
    method: 'PUT',
    body: JSON.stringify({ description }),
  });
}

export function deleteAvatar(profileId) {
  return requestJson(`/api/profile/profile/${profileId}/avatar`, {
    method: 'DELETE',
  });
}
