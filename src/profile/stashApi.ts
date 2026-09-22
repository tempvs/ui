import {
  EntityImage,
  Id,
  LibrarySourceSummary,
  Stash,
  StashGroup,
  StashItem,
  StashItemMarker,
  StashItemImage,
} from './profileTypes';

type JsonRecord = Record<string, unknown>;

type RequestOptions = RequestInit & {
  headers?: HeadersInit;
};

type PageRequest = {
  page?: number;
  size?: number;
};

type CursorPage<T> = {
  content?: T[];
  hasMore?: boolean;
  nextToken?: string;
};

type ImageUploadIntent<T> = {
  image: T;
  upload: {
    url: string;
    method: 'PUT';
    headers: Record<string, string>;
  };
};

type SourceSearchParams = {
  query?: string;
  period?: string | null;
  classifications?: string[];
  types?: string[];
  page?: number;
  size?: number;
  nextToken?: string;
};

function encodeLibraryQuery(payload: JsonRecord) {
  return window.btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

async function requestJson<TData = unknown>(url: string, options: RequestOptions = {}): Promise<TData> {
  const headers = options.body instanceof FormData
    ? options.headers
    : { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`) as Error & {
      status?: number;
      data?: unknown;
    };
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function getProfileStash(profileId: Id) {
  let nextToken: string | undefined;
  let result: (Stash & CursorPage<StashGroup>) | undefined;
  const groups: StashGroup[] = [];
  do {
    const query = new URLSearchParams({ limit: '40' });
    if (nextToken) query.set('nextToken', nextToken);
    const page = await requestJson<Stash & CursorPage<StashGroup>>(
      `/api/stash/group/profile/${profileId}?${query}`,
    );
    result ||= page;
    groups.push(...(page.groups || page.content || []));
    nextToken = page.nextToken;
  } while (nextToken);
  return { ...(result || {}), groups } as Stash;
}

export async function getGroupItems(groupId: Id, { page = 0, size = 40 }: PageRequest = {}) {
  if (page > 0) throw new Error('Offset Stash pages are no longer supported');
  const items: StashItem[] = [];
  let nextToken: string | undefined;
  do {
    const query = new URLSearchParams({ limit: String(size) });
    if (nextToken) query.set('nextToken', nextToken);
    const result = await requestJson<StashItem[] | CursorPage<StashItem>>(
      `/api/stash/group/${groupId}/item?${query}`,
    );
    if (Array.isArray(result)) {
      items.push(...result);
      nextToken = undefined;
    } else {
      items.push(...(result.content || []));
      nextToken = result.nextToken;
    }
  } while (nextToken);
  return items;
}

export function createStashGroup(profileId: Id, payload: JsonRecord) {
  return requestJson<StashGroup>(`/api/stash/group/profile/${profileId}`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(payload),
  });
}

export function updateStashGroupName(groupId: Id, name: string) {
  return requestJson<StashGroup>(`/api/stash/group/${groupId}/name`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function updateStashGroupDescription(groupId: Id, description: string) {
  return requestJson<StashGroup>(`/api/stash/group/${groupId}/description`, {
    method: 'PATCH',
    body: JSON.stringify({ description }),
  });
}

export function deleteStashGroup(groupId: Id) {
  return requestJson<unknown>(`/api/stash/group/${groupId}`, { method: 'DELETE' });
}

export function createStashItem(groupId: Id, payload: JsonRecord) {
  return requestJson<StashItem>(`/api/stash/group/${groupId}/item`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(payload),
  });
}

export function updateStashItemName(itemId: Id, name: string) {
  return requestJson<StashItem>(`/api/stash/item/${itemId}/name`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function updateStashItemDescription(itemId: Id, description: string) {
  return requestJson<StashItem>(`/api/stash/item/${itemId}/description`, {
    method: 'PATCH',
    body: JSON.stringify({ description }),
  });
}

export function getStashItemImages(itemId: Id) {
  return requestJson<{ content: StashItemImage[] }>(`/api/images/item/${itemId}?limit=100`)
    .then(page => page.content || []);
}

export function getStashEntityImages(belongsTo: string, entityIds: Id[]) {
  if (!entityIds.length) {
    return Promise.resolve([] as EntityImage[]);
  }

  return Promise.all(entityIds.map(entityId =>
    requestJson<{ content: EntityImage[] }>(
      `/api/images/${encodeURIComponent(belongsTo)}/${entityId}?limit=100`,
    ).then(page => (page.content || []).map(image => ({
      ...image,
      entityId: image.resourceId || image.entityId || String(entityId),
      belongsTo: image.resourceType || image.belongsTo || belongsTo,
    }))),
  )).then(pages => pages.flat());
}

export function uploadStashItemImage(itemId: Id, file: File, description?: string | null) {
  return requestImageUpload<StashItemImage>(`/api/stash/item/${itemId}/images`, 'POST', file, description);
}

export function replaceStashItemImage(itemId: Id, imageId: Id, file: File, description?: string | null) {
  return requestImageUpload<StashItemImage>(`/api/stash/item/${itemId}/images/${imageId}`, 'PATCH', file, description);
}

async function requestImageUpload<T>(url: string, method: 'POST' | 'PATCH', file: File, description?: string | null) {
  const intent = await requestJson<ImageUploadIntent<T>>(url, {
    method,
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      byteSize: file.size,
      ...(description !== undefined ? { description } : {}),
    }),
  });
  if (
    !intent?.upload
    || intent.upload.method !== 'PUT'
    || typeof intent.upload.url !== 'string'
    || !intent.upload.headers
    || typeof intent.upload.headers !== 'object'
  ) {
    throw new Error('Image API returned an invalid upload intent');
  }
  const response = await fetch(intent.upload.url, {
    method: 'PUT',
    headers: intent.upload.headers,
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Image upload failed with status ${response.status}`);
  }
  return intent.image;
}

/*
 * Image bytes deliberately bypass API Gateway. The Stash Lambda authorizes the
 * mutation and returns Image API metadata plus a short-lived S3 PUT URL.
 */
export function uploadStashGroupImage(groupId: Id, file: File, description?: string | null) {
  return requestImageUpload<EntityImage>(`/api/stash/group/${groupId}/images`, 'POST', file, description);
}

export function deleteStashItemImage(itemId: Id, imageId: Id) {
  return requestJson<unknown>(`/api/stash/item/${itemId}/images/${imageId}`, {
    method: 'DELETE',
  });
}

export function updateStashItemImageDescription(itemId: Id, imageId: Id, description: string) {
  return requestJson<StashItemImage>(`/api/stash/item/${itemId}/images/${imageId}/description`, {
    method: 'PATCH',
    body: JSON.stringify({ description }),
  });
}

export function deleteStashItem(itemId: Id) {
  return requestJson<unknown>(`/api/stash/item/${itemId}`, { method: 'DELETE' });
}

export function deleteStashGroupImage(groupId: Id) {
  return requestJson<unknown>(`/api/stash/group/${groupId}/images`, {
    method: 'DELETE',
  });
}

export function searchLibrarySources({ query, period, classifications, types, page = 0, size = 20, nextToken }: SourceSearchParams) {
  if (page !== 0) throw new Error('Offset Library pages are no longer supported');
  const encodedQuery = encodeLibraryQuery({
    query,
    period,
    classifications,
    types,
  });
  const params = new URLSearchParams({ limit: String(size), q: encodedQuery });
  if (nextToken) params.set('nextToken', nextToken);
  return requestJson<{ content: LibrarySourceSummary[]; nextToken: string | null }>(`/api/library/source/find?${params}`)
    .then(result => ({ content: result.content || [], nextToken: result.nextToken || null }));
}

export function getLibrarySourcesByIds(ids: Id[]) {
  if (!ids.length) {
    return Promise.resolve([] as LibrarySourceSummary[]);
  }

  const query = encodeURIComponent(encodeLibraryQuery({ ids }));
  return requestJson<LibrarySourceSummary[]>(`/api/library/source?q=${query}`);
}

export function getStashItem(itemId: Id) {
  return requestJson<StashItem>(`/api/stash/item/${itemId}`);
}

export function getStashItemMarkers(groupId: Id) {
  return requestJson<StashItemMarker[]>(`/api/stash/group/${groupId}/marker`);
}

export function createStashItemMarker(groupId: Id, payload: StashItemMarker) {
  return requestJson<StashItemMarker>(`/api/stash/group/${groupId}/marker`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(payload),
  });
}

export function updateStashItemMarker(groupId: Id, markerId: Id, payload: StashItemMarker) {
  return requestJson<StashItemMarker>(`/api/stash/group/${groupId}/marker/${markerId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteStashItemMarker(groupId: Id, markerId: Id) {
  return requestJson<unknown>(`/api/stash/group/${groupId}/marker/${markerId}`, {
    method: 'DELETE',
  });
}

export function linkStashItemSource(itemId: Id, sourceId: string) {
  return requestJson<StashItem>(`/api/stash/item/${itemId}/source/${sourceId}`, { method: 'POST' });
}

export function unlinkStashItemSource(itemId: Id, sourceId: string) {
  return requestJson<StashItem>(`/api/stash/item/${itemId}/source/${sourceId}`, { method: 'DELETE' });
}
