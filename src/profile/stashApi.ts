type JsonRecord = Record<string, unknown>;
type Id = string | number;

type RequestOptions = RequestInit & {
  headers?: HeadersInit;
};

type PageRequest = {
  page?: number;
  size?: number;
};

type SourceSearchParams = {
  query?: string;
  period?: string | null;
  classifications?: string[];
  types?: string[];
  page?: number;
  size?: number;
};

function encodeLibraryQuery(payload: JsonRecord) {
  return window.btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

async function requestJson<TData = any>(url: string, options: RequestOptions = {}): Promise<TData> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
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

export function getProfileStash(profileId: Id) {
  return requestJson(`/api/stash/group/profile/${profileId}`);
}

export function getGroupItems(groupId: Id, { page = 0, size = 40 }: PageRequest = {}) {
  return requestJson(`/api/stash/group/${groupId}/item?page=${page}&size=${size}`);
}

export function createStashGroup(profileId: Id, payload: JsonRecord) {
  return requestJson(`/api/stash/group/profile/${profileId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateStashGroupName(groupId: Id, name: string) {
  return requestJson(`/api/stash/group/${groupId}/name`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function updateStashGroupDescription(groupId: Id, description: string) {
  return requestJson(`/api/stash/group/${groupId}/description`, {
    method: 'PATCH',
    body: JSON.stringify({ description }),
  });
}

export function createStashItem(groupId: Id, payload: JsonRecord) {
  return requestJson(`/api/stash/group/${groupId}/item`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateStashItemName(itemId: Id, name: string) {
  return requestJson(`/api/stash/item/${itemId}/name`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function updateStashItemDescription(itemId: Id, description: string) {
  return requestJson(`/api/stash/item/${itemId}/description`, {
    method: 'PATCH',
    body: JSON.stringify({ description }),
  });
}

export function getStashItemImages(itemId: Id) {
  return requestJson(`/api/image/image/item/${itemId}`);
}

export function uploadStashItemImage(itemId: Id, payload: JsonRecord) {
  return requestJson(`/api/stash/item/${itemId}/images`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteStashItemImage(itemId: Id, imageId: Id) {
  return requestJson(`/api/stash/item/${itemId}/images/${imageId}`, {
    method: 'DELETE',
  });
}

export function updateStashItemImageDescription(itemId: Id, imageId: Id, description: string) {
  return requestJson(`/api/stash/item/${itemId}/images/${imageId}/description`, {
    method: 'PATCH',
    body: JSON.stringify({ description }),
  });
}

export function deleteStashItem(itemId: Id) {
  return requestJson(`/api/stash/item/${itemId}`, { method: 'DELETE' });
}

export function searchLibrarySources({ query, period, classifications, types, page = 0, size = 20 }: SourceSearchParams) {
  const encodedQuery = encodeURIComponent(encodeLibraryQuery({
    query,
    period,
    classifications,
    types,
  }));
  return requestJson(`/api/library/source/find?page=${page}&size=${size}&q=${encodedQuery}`);
}

export function getLibrarySourcesByIds(ids: Id[]) {
  const query = encodeURIComponent(encodeLibraryQuery({ ids }));
  return requestJson(`/api/library/source?q=${query}`);
}

export function linkStashItemSource(itemId: Id, sourceId: Id) {
  return requestJson(`/api/stash/item/${itemId}/source/${sourceId}`, { method: 'POST' });
}

export function unlinkStashItemSource(itemId: Id, sourceId: Id) {
  return requestJson(`/api/stash/item/${itemId}/source/${sourceId}`, { method: 'DELETE' });
}
