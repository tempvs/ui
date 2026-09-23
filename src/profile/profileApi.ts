import { doFetch } from "../util/Fetcher";

import {
  Avatar,
  CurrentUserInfo,
  Id,
  OauthProfile,
  Profile,
} from "./profileTypes";

type JsonRecord = Record<string, unknown>;
type RequestOptions = RequestInit & {
  headers?: HeadersInit;
};

type ProfileSearchParams = {
  query?: string;
  period?: string | null;
  type?: string | null;
  page?: number;
  size?: number;
};

type ProfileHandlers<TData> = {
  onSuccess: (data: TData) => void;
  onMissing?: () => void;
  onEmpty?: () => void;
  onError?: () => void;
};

type UserProfileRead = {
  profile: Profile | null;
  missing: boolean;
};

type CachedRead<T> = {
  expiresAt: number;
  request: Promise<T>;
};

// Header, Profile, and Club pages all need the active user's personal and
// Club profiles. Keep the cache deliberately short: it coalesces a page-load
// burst without turning the browser into a second source of profile data.
const PROFILE_READ_CACHE_MS = 10_000;
const userProfileReads = new Map<string, CachedRead<UserProfileRead>>();
const clubProfileReads = new Map<string, CachedRead<Profile[]>>();

function cachedRead<T>(
  cache: Map<string, CachedRead<T>>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.request;
  }

  const request = load();
  const entry: CachedRead<T> = { request, expiresAt: now + PROFILE_READ_CACHE_MS };
  cache.set(key, entry);
  request.then(
    () => undefined,
    () => {
      if (cache.get(key) === entry) cache.delete(key);
    },
  );
  return request;
}

export function invalidateProfileReadCache() {
  userProfileReads.clear();
  clubProfileReads.clear();
}

function requestJson(url: string, options: RequestOptions = {}) {
  return fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
}

export function fetchCurrentUserInfo(
  onResult: (result: CurrentUserInfo) => void,
): void {
  doFetch("/api/user/me", "GET", null, {
    200: (profile) => {
      const data = (profile || {}) as OauthProfile;
      onResult({
        currentUserId: data.userId || null,
        oauthProfile: data || null,
      });
    },
    401: () => onResult({ currentUserId: null, oauthProfile: null }),
    404: () => onResult({ currentUserId: null, oauthProfile: null }),
    default: () => onResult({ currentUserId: null, oauthProfile: null }),
  });
}

export function fetchProfileById(
  id: Id | null | undefined,
  handlers: ProfileHandlers<Profile>,
): void {
  const url = id ? `/api/profile/profile/${id}` : "/api/profile/profile";
  doFetch(url, "GET", null, {
    200: (profile) => handlers.onSuccess(profile as Profile),
    404: () => handlers.onMissing?.(),
    default: () => handlers.onError?.(),
  });
}

export function fetchUserProfileByUserId(
  userId: Id,
  handlers: ProfileHandlers<Profile | null>,
): void {
  readUserProfile(userId)
    .then(result => {
      if (result.missing) handlers.onMissing?.();
      else handlers.onSuccess(result.profile);
    })
    .catch(() => handlers.onError?.());
}

export async function getUserProfileByUserId(
  userId: Id,
): Promise<Profile | null> {
  const result = await readUserProfile(userId);
  return result.profile;
}

function readUserProfile(userId: Id): Promise<UserProfileRead> {
  const key = String(userId);
  return cachedRead(userProfileReads, key, async () => {
    const response = await requestJson(
      `/api/profile/user-profile?userId=${encodeURIComponent(key)}`,
    );
    if (response.status === 404) return { profile: null, missing: true };
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const text = await response.text();
    return {
      profile: text ? (JSON.parse(text) as Profile | null) : null,
      missing: false,
    };
  });
}

export function fetchAvatar(
  profileId: Id,
  handlers: ProfileHandlers<Avatar>,
): void {
  doFetch(`/api/images/profile/${profileId}?limit=1`, "GET", null, {
    200: (result) => {
      const avatars = (result as { content?: Avatar[] } | null)?.content;
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

export async function getProfileAvatar(profileId: Id): Promise<Avatar | null> {
  const response = await requestJson(
    `/api/images/profile/${profileId}?limit=1`,
  );
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok || !Array.isArray(data?.content) || !data.content.length) {
    return null;
  }

  return data.content[0] as Avatar;
}

export function fetchClubProfiles(
  userId: Id,
  handlers: ProfileHandlers<Profile[]>,
): void {
  readClubProfiles(userId)
    .then(handlers.onSuccess)
    .catch(() => handlers.onError?.());
}

function readClubProfiles(userId: Id): Promise<Profile[]> {
  const key = String(userId);
  return cachedRead(clubProfileReads, key, async () => {
    const response = await requestJson(
      `/api/profile/club-profile?userId=${encodeURIComponent(key)}`,
    );
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const text = await response.text();
    const profiles = text ? JSON.parse(text) : [];
    return Array.isArray(profiles) ? (profiles as Profile[]) : [];
  });
}

export async function searchProfiles({
  query,
  period,
  type,
  page = 0,
  size = 20,
}: ProfileSearchParams) {
  const params = new URLSearchParams();

  if (query) {
    params.set("query", query);
  }

  if (period) {
    params.set("period", period);
  }

  if (type) {
    params.set("type", type);
  }

  params.set("page", String(page));
  params.set("size", String(size));

  const response = await requestJson(
    `/api/profile/profile/search?${params.toString()}`,
  );
  const text = await response.text();
  const data = text ? JSON.parse(text) : [];

  if (!response.ok) {
    const error = new Error(
      `Request failed with status ${response.status}`,
    ) as Error & {
      status?: number;
      data?: unknown;
    };
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return Array.isArray(data) ? (data as Profile[]) : [];
}

export async function getFollowingProfiles(profileId: Id) {
  const response = await requestJson(
    `/api/profile/profile/${profileId}/following`,
  );
  const text = await response.text();
  const data = text ? JSON.parse(text) : [];

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return Array.isArray(data) ? (data as Profile[]) : [];
}

export async function getFollowState(targetProfileId: Id, asProfileId: Id) {
  const response = await requestJson(
    `/api/profile/profile/${targetProfileId}/follow-state?asProfileId=${asProfileId}`,
  );
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return Boolean(data?.following);
}

export function followProfile(targetProfileId: Id, asProfileId: Id) {
  return requestJson(
    `/api/profile/profile/${targetProfileId}/follow?asProfileId=${asProfileId}`,
    {
      method: "POST",
    },
  );
}

export function unfollowProfile(targetProfileId: Id, asProfileId: Id) {
  return requestJson(
    `/api/profile/profile/${targetProfileId}/follow?asProfileId=${asProfileId}`,
    {
      method: "DELETE",
    },
  );
}

export function fetchOwnerUserProfile(
  userId: Id,
  handlers: ProfileHandlers<Profile | null>,
): void {
  fetchUserProfileByUserId(userId, handlers);
}

type FetchFormEvent = {
  currentTarget?: HTMLFormElement;
  target?: EventTarget | null;
};

export function createUserProfile(
  event: FetchFormEvent,
  handlers: Record<string | number, (data?: unknown) => unknown>,
): void {
  invalidateProfileReadCache();
  doFetch("/api/profile/user-profile", "POST", event, handlers, {
    "Idempotency-Key": crypto.randomUUID(),
  });
}

export function createClubProfile(
  event: FetchFormEvent,
  handlers: Record<string | number, (data?: unknown) => unknown>,
): void {
  invalidateProfileReadCache();
  doFetch("/api/profile/club-profile", "POST", event, handlers, {
    "Idempotency-Key": crypto.randomUUID(),
  });
}

export function updateProfile(profileId: Id, payload: JsonRecord) {
  invalidateProfileReadCache();
  return requestJson(`/api/profile/profile/${profileId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteProfile(profileId: Id) {
  invalidateProfileReadCache();
  return requestJson(`/api/profile/profile/${profileId}`, {
    method: "DELETE",
  });
}

export async function uploadAvatar(
  profileId: Id,
  file: File,
  description?: string | null,
) {
  const intentResponse = await requestJson(
    `/api/profile/profile/${profileId}/avatar`,
    {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        byteSize: file.size,
        ...(description !== undefined ? { description } : {}),
      }),
    },
  );
  if (!intentResponse.ok) return intentResponse;

  const intent = (await intentResponse.json()) as {
    upload?: { url?: unknown; method?: unknown; headers?: unknown };
  };
  if (
    typeof intent.upload?.url !== "string" ||
    intent.upload.method !== "PUT" ||
    !intent.upload.headers ||
    typeof intent.upload.headers !== "object"
  ) {
    return new Response(null, {
      status: 502,
      statusText: "Invalid upload intent",
    });
  }
  return fetch(intent.upload.url, {
    method: "PUT",
    headers: intent.upload.headers as HeadersInit,
    body: file,
  });
}

export function updateAvatarDescription(
  profileId: Id,
  description: string | null,
) {
  return requestJson(`/api/profile/profile/${profileId}/avatar/description`, {
    method: "PUT",
    body: JSON.stringify({ description }),
  });
}

export function deleteAvatar(profileId: Id) {
  return requestJson(`/api/profile/profile/${profileId}/avatar`, {
    method: "DELETE",
  });
}
