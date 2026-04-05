function encodeLibraryQuery(payload) {
  return window.btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

async function requestJson(url, options = {}) {
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
    const error = new Error(`Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function getProfileStash(profileId) {
  return requestJson(`/api/stash/group/profile/${profileId}`);
}

export function getGroupItems(groupId, { page = 0, size = 40 } = {}) {
  return requestJson(`/api/stash/group/${groupId}/item?page=${page}&size=${size}`);
}

export function createStashGroup(profileId, payload) {
  return requestJson(`/api/stash/group/profile/${profileId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateStashGroupName(groupId, name) {
  return requestJson(`/api/stash/group/${groupId}/name`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function updateStashGroupDescription(groupId, description) {
  return requestJson(`/api/stash/group/${groupId}/description`, {
    method: 'PATCH',
    body: JSON.stringify({ description }),
  });
}

export function createStashItem(groupId, payload) {
  return requestJson(`/api/stash/group/${groupId}/item`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateStashItemName(itemId, name) {
  return requestJson(`/api/stash/item/${itemId}/name`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function updateStashItemDescription(itemId, description) {
  return requestJson(`/api/stash/item/${itemId}/description`, {
    method: 'PATCH',
    body: JSON.stringify({ description }),
  });
}

export function deleteStashItem(itemId) {
  return requestJson(`/api/stash/item/${itemId}`, { method: 'DELETE' });
}

export function searchLibrarySources({ query, period, classifications, types, page = 0, size = 20 }) {
  const encodedQuery = encodeURIComponent(encodeLibraryQuery({
    query,
    period,
    classifications,
    types,
  }));
  return requestJson(`/api/library/source/find?page=${page}&size=${size}&q=${encodedQuery}`);
}

export function getLibrarySourcesByIds(ids) {
  const query = encodeURIComponent(encodeLibraryQuery({ ids }));
  return requestJson(`/api/library/source?q=${query}`);
}

export function linkStashItemSource(itemId, sourceId) {
  return requestJson(`/api/stash/item/${itemId}/source/${sourceId}`, { method: 'POST' });
}

export function unlinkStashItemSource(itemId, sourceId) {
  return requestJson(`/api/stash/item/${itemId}/source/${sourceId}`, { method: 'DELETE' });
}
