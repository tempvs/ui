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
  from?: { year: number; era: "BC" | "AD" } | null;
  to?: { year: number; era: "BC" | "AD" } | null;
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
type ProfileRead = {
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
const profileReads = new Map<string, CachedRead<ProfileRead>>();
const clubProfileReads = new Map<string, CachedRead<Profile[]>>();
let currentUserInfoRead: CachedRead<CurrentUserInfo> | undefined;

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
  const entry: CachedRead<T> = {
    request,
    expiresAt: now + PROFILE_READ_CACHE_MS,
  };
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
  profileReads.clear();
  clubProfileReads.clear();
  currentUserInfoRead = undefined;
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
  void readCurrentUserInfo().then(onResult);
}

function readCurrentUserInfo(): Promise<CurrentUserInfo> {
  const now = Date.now();
  if (currentUserInfoRead && currentUserInfoRead.expiresAt > now)
    return currentUserInfoRead.request;
  const request = requestJson("/api/user/me")
    .then(async (response) => {
      if (!response.ok) return { currentUserId: null, oauthProfile: null };
      const text = await response.text();
      const data = (text ? JSON.parse(text) : {}) as OauthProfile;
      return {
        currentUserId: data.userId || null,
        oauthProfile: data || null,
      };
    })
    .catch(() => ({ currentUserId: null, oauthProfile: null }));
  currentUserInfoRead = { request, expiresAt: now + 60_000 };
  return request;
}

export function fetchProfileById(
  id: Id | null | undefined,
  handlers: ProfileHandlers<Profile>,
): void {
  if (id) {
    void readProfileById(id)
      .then((result) => {
        if (result.missing) handlers.onMissing?.();
        else if (result.profile) handlers.onSuccess(result.profile);
      })
      .catch(() => handlers.onError?.());
    return;
  }
  const url = id ? `/api/profile/profile/${id}` : "/api/profile/profile";
  doFetch(url, "GET", null, {
    200: (profile) => handlers.onSuccess(profile as Profile),
    404: () => handlers.onMissing?.(),
    default: () => handlers.onError?.(),
  });
}

function readProfileById(id: Id): Promise<ProfileRead> {
  const key = String(id);
  return cachedRead(profileReads, key, async () => {
    const response = await requestJson(
      `/api/profile/profile/${encodeURIComponent(key)}`,
    );
    if (response.status === 404) return { profile: null, missing: true };
    if (!response.ok)
      throw new Error(`Request failed with status ${response.status}`);
    return { profile: (await response.json()) as Profile, missing: false };
  });
}

/** Resolve public profile cards in a few requests instead of one per post or comment. */
export async function getProfilesByIds(
  profileIds: readonly Id[],
): Promise<Profile[]> {
  const ids = Array.from(new Set(profileIds.map(String).filter(Boolean)));
  if (!ids.length) return [];
  const profiles: Profile[] = [];
  for (let offset = 0; offset < ids.length; offset += 40) {
    const response = await requestJson(
      `/api/profile/profiles?ids=${encodeURIComponent(ids.slice(offset, offset + 40).join(","))}`,
    );
    if (!response.ok)
      throw new Error(`Request failed with status ${response.status}`);
    const page = (await response.json()) as unknown;
    if (Array.isArray(page)) profiles.push(...(page as Profile[]));
  }
  return profiles;
}

export function fetchUserProfileByUserId(
  userId: Id,
  handlers: ProfileHandlers<Profile | null>,
): void {
  readUserProfile(userId)
    .then((result) => {
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

/** Resolve personal profiles for a page of activity in one HTTP request. */
export async function getUserProfilesByUserIds(
  userIds: readonly Id[],
): Promise<Profile[]> {
  const ids = Array.from(new Set(userIds.map(String).filter(Boolean)));
  if (!ids.length) return [];
  const profiles: Profile[] = [];
  for (let offset = 0; offset < ids.length; offset += 40) {
    const response = await requestJson(
      `/api/profile/user-profiles?userIds=${encodeURIComponent(ids.slice(offset, offset + 40).join(","))}`,
    );
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const text = await response.text();
    const page: unknown = text ? JSON.parse(text) : [];
    if (Array.isArray(page)) profiles.push(...(page as Profile[]));
  }
  return profiles;
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

/** All profile pictures. The first image remains the profile's thumbnail. */
export async function getProfileImages(profileId: Id): Promise<Avatar[]> {
  const response = await requestJson(
    `/api/images/profile/${profileId}?limit=100`,
  );
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return response.ok && Array.isArray(data?.content)
    ? (data.content as Avatar[])
    : [];
}

export function fetchClubProfiles(
  userId: Id,
  handlers: ProfileHandlers<Profile[]>,
): void {
  readClubProfiles(userId)
    .then(handlers.onSuccess)
    .catch(() => handlers.onError?.());
}

/**
 * Promise counterpart for views which load a signed-in user's complete
 * identity context at once (for example the personal map overlay). Keeping
 * this on the same cached read as the callback API prevents a second request
 * when Header/ProfilePage are mounting at the same time.
 */
export async function getClubProfiles(userId: Id): Promise<Profile[]> {
  return readClubProfiles(userId);
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
  from,
  to,
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
  if (from) {
    params.set("fromYear", String(from.year));
    params.set("fromEra", from.era);
  }
  if (to) {
    params.set("toYear", String(to.year));
    params.set("toEra", to.era);
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

export async function getFriendPostAccess(
  targetProfileId: Id,
  asProfileId: Id,
) {
  const response = await requestJson(
    `/api/profile/profile/${targetProfileId}/friend-post-access?asProfileId=${asProfileId}`,
  );
  if (!response.ok) return false;
  return (
    ((await response.json()) as { canCreate?: unknown }).canCreate === true
  );
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

export type PrivateProfilePin = {
  latitude: number;
  longitude: number;
  label?: string | null;
};

export async function getPrivateProfilePin(
  profileId: Id,
): Promise<PrivateProfilePin | null> {
  const response = await requestJson(
    `/api/profile/profile/${profileId}/private-pin`,
  );
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Unable to load private pin (${response.status})`);
  const text = await response.text();
  return text ? (JSON.parse(text) as PrivateProfilePin | null) : null;
}

export async function savePrivateProfilePin(
  profileId: Id,
  pin: PrivateProfilePin,
): Promise<PrivateProfilePin> {
  const response = await requestJson(
    `/api/profile/profile/${profileId}/private-pin`,
    {
      method: "PUT",
      body: JSON.stringify(pin),
    },
  );
  if (!response.ok)
    throw new Error(`Unable to save private pin (${response.status})`);
  return JSON.parse((await response.text()) || "{}") as PrivateProfilePin;
}

export async function deletePrivateProfilePin(profileId: Id): Promise<void> {
  const response = await requestJson(
    `/api/profile/profile/${profileId}/private-pin`,
    {
      method: "DELETE",
    },
  );
  if (!response.ok && response.status !== 404)
    throw new Error(`Unable to remove private pin (${response.status})`);
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
): Promise<Avatar> {
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
  if (!intentResponse.ok) {
    throw new Error(
      `Unable to prepare profile picture upload (${intentResponse.status})`,
    );
  }

  const intent = (await intentResponse.json()) as {
    image?: Avatar;
    upload?: { url?: unknown; method?: unknown; headers?: unknown };
  };
  if (
    typeof intent.upload?.url !== "string" ||
    intent.upload.method !== "PUT" ||
    !intent.upload.headers ||
    typeof intent.upload.headers !== "object"
  ) {
    throw new Error("Invalid profile picture upload intent");
  }
  if (!intent.image?.id) {
    throw new Error("Profile picture upload did not return image metadata");
  }
  const upload = await fetch(intent.upload.url, {
    method: "PUT",
    headers: intent.upload.headers as HeadersInit,
    body: file,
  });
  if (!upload.ok) {
    throw new Error(`Profile picture upload failed (${upload.status})`);
  }
  return intent.image;
}

async function uploadProfileImageRequest(
  profileId: Id,
  file: File,
  description: string | null | undefined,
  method: "POST" | "PATCH",
  imageId?: Id,
): Promise<Avatar> {
  const endpoint = imageId
    ? `/api/profile/profile/${profileId}/images/${imageId}`
    : `/api/profile/profile/${profileId}/images`;
  const intentResponse = await requestJson(endpoint, {
    method,
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      byteSize: file.size,
      ...(description !== undefined ? { description } : {}),
    }),
  });
  if (!intentResponse.ok) {
    throw new Error(
      `Unable to prepare profile picture upload (${intentResponse.status})`,
    );
  }
  const intent = (await intentResponse.json()) as {
    image?: Avatar;
    upload?: { url?: unknown; method?: unknown; headers?: unknown };
  };
  if (
    typeof intent.upload?.url !== "string" ||
    intent.upload.method !== "PUT" ||
    !intent.upload.headers ||
    typeof intent.upload.headers !== "object" ||
    !intent.image?.id
  ) {
    throw new Error("Invalid profile picture upload intent");
  }
  const upload = await fetch(intent.upload.url, {
    method: "PUT",
    headers: intent.upload.headers as HeadersInit,
    body: file,
  });
  if (!upload.ok) {
    throw new Error(`Profile picture upload failed (${upload.status})`);
  }
  return intent.image;
}

export function uploadProfileImage(
  profileId: Id,
  file: File,
  description?: string | null,
) {
  return uploadProfileImageRequest(profileId, file, description, "POST");
}

export function replaceProfileImage(
  profileId: Id,
  imageId: Id,
  file: File,
  description?: string | null,
) {
  return uploadProfileImageRequest(
    profileId,
    file,
    description,
    "PATCH",
    imageId,
  );
}

export function updateProfileImageDescription(
  profileId: Id,
  imageId: Id,
  description: string | null,
) {
  return requestJson(
    `/api/profile/profile/${profileId}/images/${imageId}/description`,
    {
      method: "PUT",
      body: JSON.stringify({ description }),
    },
  );
}

export function deleteProfileImage(profileId: Id, imageId: Id) {
  return requestJson(`/api/profile/profile/${profileId}/images/${imageId}`, {
    method: "DELETE",
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
