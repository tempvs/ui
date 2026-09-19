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
  id: string;
  version: number;
  name?: string | null;
  description?: string | null;
  period?: string | null;
  classification?: string | null;
  type?: string | null;
};

export type LibrarySourceImage = {
  id: string;
  url?: string | null;
  thumbnailUrl?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  fileName?: string | null;
  description?: string | null;
};

export type LibraryRoleRequest = {
  userId: string;
  profileId: string | null;
  userName?: string | null;
  role: string;
  roleLabel?: string | null;
};

type LibraryAdminRoleRequests = {
  roleRequests?: LibraryRoleRequest[] | null;
  nextToken?: string | null;
};

type LibrarySourcePage = {
  content: LibrarySource[];
  nextToken: string | null;
};

type ImageUploadIntent = {
  image: LibrarySourceImage;
  upload: { method: 'PUT'; url: string; headers: Record<string, string> };
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
  nextToken?: string;
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

export async function findSources({ query, period, classifications, types, page = 0, size = 40, nextToken }: SourceSearchParams) {
  if (page !== 0) throw new Error('Offset Library pages are no longer supported');
  const encodedQuery = buildSearchQuery(query, period, classifications, types);
  const params = new URLSearchParams({ limit: String(size), q: encodedQuery });
  if (nextToken) params.set('nextToken', nextToken);
  const result = await fetchJson<LibrarySourcePage, LibraryUserInfoPayload>(`/api/library/source/find?${params}`);
  return { ...result, data: result.data?.content || [], nextToken: result.data?.nextToken || null };
}

export async function createSource(payload: SourcePayload) {
  const response = await fetch('/api/library/source', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': newIdempotencyKey(),
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<LibrarySource | ApiErrorPayload>(response);
}

export function getAdminRoleRequests({ size = 40, nextToken }: { size?: number; nextToken?: string }) {
  const params = new URLSearchParams({ limit: String(size) });
  if (nextToken) params.set('nextToken', nextToken);
  return fetchJson<LibraryAdminRoleRequests>(`/api/library/library/admin?${params}`);
}

export function updateAdminRoleRequest(role: string, userId: string, method: string) {
  return fetchJson<LibraryAdminRoleRequests | { operationId: string; status: string }>(`/api/library/library/${role}/${userId}`, { method });
}

export function getSource(sourceId: string | undefined) {
  return fetchJson<LibrarySource, LibraryUserInfoPayload>(`/api/library/source/${sourceId}`);
}

export function getSourceImages(sourceId: string | undefined) {
  return fetchJson<{ content: LibrarySourceImage[] }>(
    `/api/images/source/${sourceId}?limit=100`,
  ).then(result => ({
    ...result,
    data: result.data?.content || [],
  }) as ApiResponse<LibrarySourceImage[]>);
}

export async function patchSourceField(sourceId: string | undefined, field: string, value: unknown, version: number) {
  const response = await fetch(`/api/library/source/${sourceId}/${field}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'If-Match': `"${version}"`,
    },
    body: JSON.stringify({ [field]: value }),
  });

  return parseResponse<LibrarySource | ApiErrorPayload>(response);
}

export async function removeSource(sourceId: string | undefined, version: number) {
  const response = await fetch(`/api/library/source/${sourceId}`, { method: 'DELETE', headers: { 'If-Match': `"${version}"` } });
  return parseResponse<ApiErrorPayload | string>(response);
}

export async function uploadSourceImage(sourceId: string | undefined, file: File, description?: string | null) {
  return sourceImageIntent(`/api/library/source/${sourceId}/images`, 'POST', file, description);
}

export async function replaceSourceImage(
  sourceId: string | undefined,
  imageId: string,
  file: File,
  description?: string | null,
) {
  return sourceImageIntent(`/api/library/source/${sourceId}/images/${imageId}`, 'PATCH', file, description);
}

async function sourceImageIntent(url: string, method: 'POST' | 'PATCH', file: File, description?: string | null): Promise<ApiResponse<LibrarySourceImage | ApiErrorPayload>> {
  const result = await fetchJson<ImageUploadIntent | ApiErrorPayload>(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      byteSize: file.size,
      ...(description !== undefined ? { description } : {}),
    }),
  });
  if (!result.ok) return { ...result, data: result.data as ApiErrorPayload | null };
  const intent = result.data as ImageUploadIntent | null;
  if (!intent?.upload || intent.upload.method !== 'PUT' || !intent.upload.url || !intent.upload.headers || !intent.image) {
    throw new Error('Library returned an invalid image upload intent');
  }
  const upload = await fetch(intent.upload.url, {
    method: 'PUT',
    headers: intent.upload.headers,
    body: file,
  });
  if (!upload.ok) throw new Error(`Image upload failed with status ${upload.status}`);
  return { ...result, data: intent.image };
}

function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `library-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function deleteSourceImage(sourceId: string | undefined, imageId: string) {
  const response = await fetch(`/api/library/source/${sourceId}/images/${imageId}`, {
    method: 'DELETE',
  });

  return parseResponse<ApiErrorPayload>(response);
}

export async function updateSourceImageDescription(
  sourceId: string | undefined,
  imageId: string,
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
