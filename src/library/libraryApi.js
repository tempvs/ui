function parseUserInfo(headerValue) {
  if (!headerValue) {
    return null;
  }

  try {
    return JSON.parse(headerValue);
  } catch (error) {
    return null;
  }
}

async function parseResponse(response) {
  const userInfo = parseUserInfo(response.headers.get('User-Info'));
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    userInfo,
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  return parseResponse(response);
}

export function buildSearchQuery(query, period, classifications, types) {
  return window.btoa(encodeURIComponent(JSON.stringify({
    query,
    period,
    classifications,
    types,
  })));
}

export function getWelcome() {
  return fetchJson('/api/library/library');
}

export function updateRoleRequest(role, method) {
  return fetchJson(`/api/library/library/role/${role}`, { method });
}

export function findSources({ query, period, classifications, types, page = 0, size }) {
  const encodedQuery = buildSearchQuery(query, period, classifications, types);
  return fetchJson(`/api/library/source/find?page=${page}&size=${size}&q=${encodedQuery}`);
}

export async function createSource(payload) {
  const response = await fetch('/api/library/source', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export function getAdminRoleRequests({ page = 0, size }) {
  return fetchJson(`/api/library/library/admin?page=${page}&size=${size}`);
}

export function updateAdminRoleRequest(role, userId, method) {
  return fetchJson(`/api/library/library/${role}/${userId}`, { method });
}

export function getSource(sourceId) {
  return fetchJson(`/api/library/source/${sourceId}`);
}

export function getSourceImages(sourceId) {
  return fetchJson(`/api/image/image/source/${sourceId}`);
}

export async function patchSourceField(sourceId, field, value) {
  const response = await fetch(`/api/library/source/${sourceId}/${field}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ [field]: value }),
  });

  return parseResponse(response);
}

export async function removeSource(sourceId) {
  const response = await fetch(`/api/library/source/${sourceId}`, { method: 'DELETE' });
  return parseResponse(response);
}

export async function uploadSourceImage(sourceId, payload) {
  const response = await fetch(`/api/library/source/${sourceId}/images`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function deleteSourceImage(sourceId, imageId) {
  const response = await fetch(`/api/library/source/${sourceId}/images/${imageId}`, {
    method: 'DELETE',
  });

  return parseResponse(response);
}

export async function updateSourceImageDescription(sourceId, imageId, description) {
  const response = await fetch(`/api/library/source/${sourceId}/images/${imageId}/description`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ description }),
  });

  return parseResponse(response);
}
