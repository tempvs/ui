export type ApiResponse<TData = unknown, TUserInfo = unknown> = {
  ok: boolean;
  status: number;
  data: TData | null;
  userInfo: TUserInfo | null;
};

export type LibraryUserInfoPayload = {
  roles?: string[] | null;
} | null;

export type LibraryWelcome = {
  role?: string | null;
  roleRequestAvailable?: boolean | null;
  adminPanelAvailable?: boolean | null;
  buttonText?: string | null;
};

export type LibrarySource = {
  id: string | number;
  name?: string | null;
  description?: string | null;
  period?: string | null;
  classification?: string | null;
  type?: string | null;
};

export type LibrarySourceImage = {
  id: string | number;
  url?: string | null;
  src?: string | null;
  fileName?: string | null;
  description?: string | null;
};

export type LibraryRoleRequest = {
  userId: string | number;
  profileId: string | number;
  userName?: string | null;
  role: string;
  roleLabel?: string | null;
};

type LibraryAdminRoleRequests = {
  roleRequests?: LibraryRoleRequest[] | null;
};

type ApiErrorPayload = {
  message?: string | null;
};

type FetchJsonOptions = RequestInit;

type SourceSearchParams = {
  query?: string;
  period?: string | null;
  classifications?: string[];
  types?: string[];
  page?: number;
  size?: number;
};

type SourcePayload = Record<string, unknown>;

function parseUserInfo(headerValue: string | null): unknown | null {
  if (!headerValue) {
    return null;
  }

  try {
    return JSON.parse(headerValue);
  } catch (error) {
    return null;
  }
}

async function parseResponse<TData = unknown, TUserInfo = unknown>(response: Response): Promise<ApiResponse<TData, TUserInfo>> {
  const userInfo = parseUserInfo(response.headers.get('User-Info')) as TUserInfo | null;
  const text = await response.text();
  let data: TData | null = null;

  if (text) {
    try {
      data = JSON.parse(text) as TData;
    } catch (error) {
      data = text as TData;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    userInfo,
  };
}

async function fetchJson<TData = unknown, TUserInfo = unknown>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<ApiResponse<TData, TUserInfo>> {
  const response = await fetch(url, options);
  return parseResponse<TData, TUserInfo>(response);
}

export function buildSearchQuery(
  query?: string,
  period?: string | null,
  classifications?: string[],
  types?: string[]
): string {
  return window.btoa(encodeURIComponent(JSON.stringify({
    query,
    period,
    classifications,
    types,
  })));
}

export function getWelcome() {
  return fetchJson<LibraryWelcome, LibraryUserInfoPayload>('/api/library/library');
}

export function updateRoleRequest(role: string, method: string) {
  return fetchJson<LibraryWelcome, LibraryUserInfoPayload>(`/api/library/library/role/${role}`, { method });
}

export function findSources({ query, period, classifications, types, page = 0, size }: SourceSearchParams) {
  const encodedQuery = buildSearchQuery(query, period, classifications, types);
  return fetchJson<LibrarySource[], LibraryUserInfoPayload>(`/api/library/source/find?page=${page}&size=${size}&q=${encodedQuery}`);
}

export async function createSource(payload: SourcePayload) {
  const response = await fetch('/api/library/source', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<LibrarySource | ApiErrorPayload>(response);
}

export function getAdminRoleRequests({ page = 0, size }: { page?: number; size?: number }) {
  return fetchJson<LibraryAdminRoleRequests>(`/api/library/library/admin?page=${page}&size=${size}`);
}

export function updateAdminRoleRequest(role: string, userId: string | number, method: string) {
  return fetchJson<LibraryAdminRoleRequests>(`/api/library/library/${role}/${userId}`, { method });
}

export function getSource(sourceId: string | number | undefined) {
  return fetchJson<LibrarySource, LibraryUserInfoPayload>(`/api/library/source/${sourceId}`);
}

export function getSourceImages(sourceId: string | number | undefined) {
  return fetchJson<LibrarySourceImage[]>(`/api/image/image/source/${sourceId}`);
}

export async function patchSourceField(sourceId: string | number | undefined, field: string, value: unknown) {
  const response = await fetch(`/api/library/source/${sourceId}/${field}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ [field]: value }),
  });

  return parseResponse<LibrarySource | ApiErrorPayload>(response);
}

export async function removeSource(sourceId: string | number | undefined) {
  const response = await fetch(`/api/library/source/${sourceId}`, { method: 'DELETE' });
  return parseResponse<ApiErrorPayload | string>(response);
}

export async function uploadSourceImage(sourceId: string | number | undefined, payload: SourcePayload) {
  const response = await fetch(`/api/library/source/${sourceId}/images`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<LibrarySourceImage | ApiErrorPayload>(response);
}

export async function deleteSourceImage(sourceId: string | number | undefined, imageId: string | number) {
  const response = await fetch(`/api/library/source/${sourceId}/images/${imageId}`, {
    method: 'DELETE',
  });

  return parseResponse<ApiErrorPayload>(response);
}

export async function updateSourceImageDescription(
  sourceId: string | number | undefined,
  imageId: string | number,
  description: string
) {
  const response = await fetch(`/api/library/source/${sourceId}/images/${imageId}/description`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ description }),
  });

  return parseResponse<LibrarySourceImage | ApiErrorPayload>(response);
}
