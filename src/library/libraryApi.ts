import { getViewer, type Viewer } from "../auth/viewerApi";

export type ApiResponse<TData = unknown> = {
  ok: boolean;
  status: number;
  data: TData | null;
};

export type LibraryViewer = Viewer | null;

export type LibraryWelcome = {
  adminPanelAvailable?: boolean | null;
  roleRequests?: Array<{
    role: string;
    label: string;
    description: string;
    pending: boolean;
  }> | null;
};

export type LibrarySource = {
  id: string;
  version: number;
  name?: string | null;
  description?: string | null;
  period?: string | null;
  classification?: string | null;
  type?: string | null;
  from?: HistoricalYear | null;
  to?: HistoricalYear | null;
  discoveredAtPlaceId?: string | null;
  discoveredAtPlaceName?: string | null;
  heldAtPlaceId?: string | null;
  heldAtPlaceName?: string | null;
};

export type HistoricalEra = "BC" | "AD";
export type HistoricalYear = { year: number; era: HistoricalEra };

export type LibrarySourceProfile = {
  id: string;
  name?: string | null;
  alias?: string | null;
  period?: string | null;
  avatarUrl?: string | null;
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

export type LibraryMember = {
  userId: string;
  email: string | null;
  name: string | null;
  role: "ROLE_CONTRIBUTOR" | "ROLE_SCRIBE" | "ROLE_ARCHIVARIUS" | "ROLE_ADMIN";
};

export type SourceChangeProposal = {
  id: string;
  sourceId: string;
  proposerId: string;
  changes: Partial<Pick<LibrarySource, "name" | "description" | "from" | "to">>;
  previous: Partial<
    Pick<LibrarySource, "name" | "description" | "from" | "to">
  >;
  baseVersion: number;
  status: "PENDING" | "APPLIED" | "REJECTED" | "SUPERSEDED";
  createdAt: string;
};

export type SourceChangesetStatus =
  "PENDING" | "APPLIED" | "REJECTED" | "WITHDRAWN" | "SUPERSEDED";

export type SourceChangesetSnapshot = Required<
  Pick<
    LibrarySource,
    "name" | "description" | "period" | "classification" | "type"
  >
> & {
  from: HistoricalYear | null;
  to: HistoricalYear | null;
  discoveredAtPlaceId?: string | null;
  discoveredAtPlaceName?: string | null;
  heldAtPlaceId?: string | null;
  heldAtPlaceName?: string | null;
};

export type SourceChangeset = {
  id: string;
  sourceId: string;
  proposerId: string;
  baseVersion: number;
  kind?: "UPDATE" | "DELETE";
  status: SourceChangesetStatus;
  base: SourceChangesetSnapshot;
  proposed: SourceChangesetSnapshot;
  imageOperations: SourceImageOperation[];
  version: number;
  createdAt: string;
  updatedAt: string;
  reviewerId?: string | null;
  reviewedAt?: string | null;
  reviewComment?: string | null;
};

export type SourceChangesetDraft = {
  proposed: SourceChangesetSnapshot;
  imageOperations?: SourceImageOperation[];
};

export type SourceImageOperation =
  | { kind: "ADD"; stagedImageId: string; description: string | null }
  | { kind: "REMOVE"; imageId: string }
  | {
      kind: "REPLACE";
      imageId: string;
      stagedImageId: string;
      description: string | null;
    }
  | { kind: "UPDATE_DESCRIPTION"; imageId: string; description: string | null };

export type PendingSourceChangeset = {
  source: LibrarySource;
  changeset: SourceChangeset;
};

export type SourceChangeLogEntry = {
  id: string;
  sourceId: string;
  action:
    | "CREATED"
    | "PROPOSAL_APPLIED"
    | "PROPOSAL_REJECTED"
    | "PROPOSAL_SUPERSEDED";
  actorId: string;
  proposerId?: string;
  proposalId?: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  createdAt: string;
};

type LibraryAdminRoleRequests = {
  roleRequests?: LibraryRoleRequest[] | null;
  nextToken?: string | null;
};

type LibraryAdminMembers = {
  members?: LibraryMember[] | null;
  memberUserIds?: string[] | null;
};

type LibrarySourcePage = {
  content: LibrarySource[];
  nextToken: string | null;
};

type ImageUploadIntent = {
  image: LibrarySourceImage;
  upload: { method: "PUT"; url: string; headers: Record<string, string> };
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
  from?: HistoricalYear | null;
  to?: HistoricalYear | null;
  page?: number;
  size?: number;
  nextToken?: string;
};

type SourcePayload = Record<string, unknown>;

async function parseResponse<TData = unknown>(
  response: Response,
): Promise<ApiResponse<TData>> {
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
  };
}

async function fetchJson<TData = unknown>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<ApiResponse<TData>> {
  const response = await fetch(url, options);
  return parseResponse<TData>(response);
}

export function getLibraryViewer(): Promise<LibraryViewer> {
  // A source view must never force a Cognito refresh. A forced refresh can
  // fail independently of an otherwise valid opaque session and used to make
  // simply opening a public source appear to log the visitor out.
  return getViewer();
}

export function buildSearchQuery(
  query?: string,
  period?: string | null,
  classifications?: string[],
  types?: string[],
  from?: HistoricalYear | null,
  to?: HistoricalYear | null,
): string {
  return window.btoa(
    encodeURIComponent(
      JSON.stringify({
        query,
        period,
        classifications,
        types,
        from,
        to,
      }),
    ),
  );
}

export function getWelcome() {
  return fetchJson<LibraryWelcome>("/api/library/library");
}

export function updateRoleRequest(role: string, method: string) {
  return fetchJson<LibraryWelcome>(`/api/library/library/role/${role}`, {
    method,
  });
}

export async function findSources({
  query,
  period,
  classifications,
  types,
  from,
  to,
  page = 0,
  size = 40,
  nextToken,
}: SourceSearchParams) {
  if (page !== 0)
    throw new Error("Offset Library pages are no longer supported");
  const encodedQuery = buildSearchQuery(
    query,
    period,
    classifications,
    types,
    from,
    to,
  );
  const params = new URLSearchParams({ limit: String(size), q: encodedQuery });
  if (nextToken) params.set("nextToken", nextToken);
  const result = await fetchJson<LibrarySourcePage>(
    `/api/library/source/find?${params}`,
  );
  return {
    ...result,
    data: result.data?.content || [],
    nextToken: result.data?.nextToken || null,
  };
}

export async function createSource(payload: SourcePayload) {
  const response = await fetch("/api/library/source", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": newIdempotencyKey(),
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<LibrarySource | ApiErrorPayload>(response);
}

export function getAdminRoleRequests({
  size = 40,
  nextToken,
}: {
  size?: number;
  nextToken?: string;
}) {
  const params = new URLSearchParams({ limit: String(size) });
  if (nextToken) params.set("nextToken", nextToken);
  return fetchJson<LibraryAdminRoleRequests>(
    `/api/library/library/admin?${params}`,
  );
}

export function updateAdminRoleRequest(
  role: string,
  userId: string,
  method: string,
) {
  return fetchJson<
    LibraryAdminRoleRequests | { operationId: string; status: string }
  >(`/api/library/library/${role}/${userId}`, { method });
}

export function getAdminMembers() {
  return fetchJson<LibraryAdminMembers>("/api/library/library/admin/users");
}

export function setAdminMemberRole(userId: string, role: string) {
  return fetchJson<LibraryAdminMembers>(
    `/api/library/library/admin/users/${userId}/role`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    },
  );
}

export function getSource(sourceId: string | undefined) {
  return fetchJson<LibrarySource>(`/api/library/source/${sourceId}`);
}

export function getSourceImages(sourceId: string | undefined) {
  return fetchJson<{ content: LibrarySourceImage[] }>(
    `/api/images/source/${sourceId}?limit=100`,
  ).then(
    (result) =>
      ({
        ...result,
        data: result.data?.content || [],
      }) as ApiResponse<LibrarySourceImage[]>,
  );
}

export function getSourceProfiles(sourceId: string | undefined) {
  return fetchJson<LibrarySourceProfile[]>(
    `/api/stash/source/${sourceId}/profiles`,
  ).then(
    (result) =>
      ({
        ...result,
        data: Array.isArray(result.data) ? result.data : [],
      }) as ApiResponse<LibrarySourceProfile[]>,
  );
}

export async function patchSourceField(
  sourceId: string | undefined,
  field: string,
  value: unknown,
  version: number,
) {
  const response = await fetch(`/api/library/source/${sourceId}/${field}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "If-Match": `"${version}"`,
    },
    body: JSON.stringify({ [field]: value }),
  });

  return parseResponse<
    | { source?: LibrarySource; proposal?: SourceChangeProposal }
    | ApiErrorPayload
  >(response);
}

export async function patchSourceRange(
  sourceId: string | undefined,
  range: { from: HistoricalYear | null; to: HistoricalYear | null },
  version: number,
) {
  const response = await fetch(`/api/library/source/${sourceId}/range`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "If-Match": `"${version}"`,
    },
    body: JSON.stringify(range),
  });
  return parseResponse<
    | { source?: LibrarySource; proposal?: SourceChangeProposal }
    | ApiErrorPayload
  >(response);
}

export function getSourceProposals(sourceId: string | undefined) {
  return fetchJson<{ proposals?: SourceChangeProposal[] | null }>(
    `/api/library/source/${sourceId}/proposals`,
  ).then(
    (result) =>
      ({ ...result, data: result.data?.proposals || [] }) as ApiResponse<
        SourceChangeProposal[]
      >,
  );
}

export function getSourceChangesets(
  sourceId: string | undefined,
  nextToken?: string,
  limit = 40,
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (nextToken) params.set("nextToken", nextToken);
  return fetchJson<{ content?: SourceChangeset[]; nextToken?: string | null }>(
    `/api/library/source/${sourceId}/changesets?${params}`,
  ).then(
    (result) =>
      ({
        ...result,
        data: {
          content: result.data?.content || [],
          nextToken: result.data?.nextToken || null,
        },
      }) as ApiResponse<{
        content: SourceChangeset[];
        nextToken: string | null;
      }>,
  );
}

export function getSourceChangeset(
  sourceId: string | undefined,
  changesetId: string | undefined,
) {
  return fetchJson<SourceChangeset>(
    `/api/library/source/${sourceId}/changesets/${changesetId}`,
  );
}

export function createSourceChangeset(
  sourceId: string | undefined,
  draft: SourceChangesetDraft,
  baseVersion: number,
) {
  return fetchJson<SourceChangeset | ApiErrorPayload>(
    `/api/library/source/${sourceId}/changesets`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "If-Match": `"${baseVersion}"`,
        "Idempotency-Key": newIdempotencyKey(),
      },
      body: JSON.stringify(draft),
    },
  );
}

export function amendSourceChangeset(
  sourceId: string | undefined,
  changesetId: string,
  draft: SourceChangesetDraft,
  version: number,
) {
  return fetchJson<SourceChangeset | ApiErrorPayload>(
    `/api/library/source/${sourceId}/changesets/${changesetId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "If-Match": `"${version}"`,
      },
      body: JSON.stringify(draft),
    },
  );
}

export function withdrawSourceChangeset(
  sourceId: string | undefined,
  changesetId: string,
  version: number,
) {
  return fetchJson<SourceChangeset | ApiErrorPayload>(
    `/api/library/source/${sourceId}/changesets/${changesetId}/withdraw`,
    { method: "POST", headers: { "If-Match": `"${version}"` } },
  );
}

export function rebaseSourceChangeset(
  sourceId: string | undefined,
  changesetId: string,
  version: number,
) {
  return fetchJson<SourceChangeset | ApiErrorPayload>(
    `/api/library/source/${sourceId}/changesets/${changesetId}/rebase`,
    { method: "POST", headers: { "If-Match": `"${version}"` } },
  );
}

export function approveSourceChangeset(
  sourceId: string | undefined,
  changesetId: string,
  version: number,
  comment?: string,
) {
  return fetchJson<
    { source: LibrarySource; changeset: SourceChangeset } | ApiErrorPayload
  >(`/api/library/source/${sourceId}/changesets/${changesetId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "If-Match": `"${version}"` },
    body: JSON.stringify(comment ? { comment } : {}),
  });
}

export function rejectSourceChangeset(
  sourceId: string | undefined,
  changesetId: string,
  version: number,
  comment: string,
) {
  return fetchJson<SourceChangeset | ApiErrorPayload>(
    `/api/library/source/${sourceId}/changesets/${changesetId}/reject`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "If-Match": `"${version}"`,
      },
      body: JSON.stringify({ comment }),
    },
  );
}

export function getPendingSourceChangesets({
  query,
  period,
  type,
  classification,
  nextToken,
  limit = 40,
}: {
  query?: string;
  period?: string;
  type?: string;
  classification?: string;
  nextToken?: string;
  limit?: number;
}) {
  const params = new URLSearchParams({ limit: String(limit) });
  for (const [key, value] of Object.entries({
    query,
    period,
    type,
    classification,
    nextToken,
  })) {
    if (value) params.set(key, value);
  }
  return fetchJson<{
    content?: PendingSourceChangeset[];
    nextToken?: string | null;
  }>(`/api/library/library/admin/changesets?${params}`);
}

export function getSourceChangesetImages(
  sourceId: string,
  changesetId: string,
) {
  return fetchJson<{ content?: LibrarySourceImage[] }>(
    `/api/images/source-changeset/${sourceId}/${changesetId}`,
  ).then(
    (result) =>
      ({ ...result, data: result.data?.content || [] }) as ApiResponse<
        LibrarySourceImage[]
      >,
  );
}

export async function uploadSourceChangesetImage(
  sourceId: string,
  changesetId: string,
  imageId: string,
  file: File,
  description: string | null,
): Promise<ApiResponse<LibrarySourceImage | ApiErrorPayload>> {
  const result = await fetchJson<ImageUploadIntent | ApiErrorPayload>(
    `/api/images/source-changeset/${sourceId}/${changesetId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageId,
        fileName: file.name,
        contentType: file.type,
        byteSize: file.size,
        description,
      }),
    },
  );
  if (!result.ok)
    return { ...result, data: result.data as ApiErrorPayload | null };
  const intent = result.data as ImageUploadIntent | null;
  if (!intent?.upload || !intent.image) {
    return {
      ok: false,
      status: 500,
      data: { message: "Invalid staged image upload response" },
    };
  }
  const uploaded = await fetch(intent.upload.url, {
    method: intent.upload.method,
    headers: intent.upload.headers,
    body: file,
  });
  if (!uploaded.ok) {
    return {
      ok: false,
      status: uploaded.status,
      data: { message: "Unable to upload staged image" },
    };
  }
  return { ok: true, status: 201, data: intent.image };
}

export function applySourceProposal(
  sourceId: string | undefined,
  proposalId: string,
) {
  return fetchJson<LibrarySource | ApiErrorPayload>(
    `/api/library/source/${sourceId}/proposals/${proposalId}/apply`,
    { method: "POST" },
  );
}

export function rejectSourceProposal(
  sourceId: string | undefined,
  proposalId: string,
) {
  return fetchJson<SourceChangeProposal | ApiErrorPayload>(
    `/api/library/source/${sourceId}/proposals/${proposalId}/reject`,
    { method: "POST" },
  );
}

export function getSourceChangeLog(sourceId: string | undefined) {
  return fetchJson<{ changes?: SourceChangeLogEntry[] | null }>(
    `/api/library/source/${sourceId}/change-log`,
  ).then(
    (result) =>
      ({ ...result, data: result.data?.changes || [] }) as ApiResponse<
        SourceChangeLogEntry[]
      >,
  );
}

export async function proposeSourceDeletion(
  sourceId: string | undefined,
  version: number,
) {
  const response = await fetch(`/api/library/source/${sourceId}`, {
    method: "DELETE",
    headers: { "If-Match": `"${version}"` },
  });
  return parseResponse<ApiErrorPayload | string>(response);
}

/** @deprecated Use proposeSourceDeletion to make review semantics explicit. */
export const removeSource = proposeSourceDeletion;

export async function uploadSourceImage(
  sourceId: string | undefined,
  file: File,
  description?: string | null,
) {
  return sourceImageIntent(
    `/api/library/source/${sourceId}/images`,
    "POST",
    file,
    description,
  );
}

export async function replaceSourceImage(
  sourceId: string | undefined,
  imageId: string,
  file: File,
  description?: string | null,
) {
  return sourceImageIntent(
    `/api/library/source/${sourceId}/images/${imageId}`,
    "PATCH",
    file,
    description,
  );
}

async function sourceImageIntent(
  url: string,
  method: "POST" | "PATCH",
  file: File,
  description?: string | null,
): Promise<ApiResponse<LibrarySourceImage | ApiErrorPayload>> {
  const result = await fetchJson<ImageUploadIntent | ApiErrorPayload>(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": newIdempotencyKey(),
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      byteSize: file.size,
      ...(description !== undefined ? { description } : {}),
    }),
  });
  if (!result.ok)
    return { ...result, data: result.data as ApiErrorPayload | null };
  const intent = result.data as ImageUploadIntent | null;
  if (
    !intent?.upload ||
    intent.upload.method !== "PUT" ||
    !intent.upload.url ||
    !intent.upload.headers ||
    !intent.image
  ) {
    throw new Error("Library returned an invalid image upload intent");
  }
  const upload = await fetch(intent.upload.url, {
    method: "PUT",
    headers: intent.upload.headers,
    body: file,
  });
  if (!upload.ok)
    throw new Error(`Image upload failed with status ${upload.status}`);
  return { ...result, data: intent.image };
}

function newIdempotencyKey(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `library-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export async function deleteSourceImage(
  sourceId: string | undefined,
  imageId: string,
) {
  const response = await fetch(
    `/api/library/source/${sourceId}/images/${imageId}`,
    {
      method: "DELETE",
    },
  );

  return parseResponse<ApiErrorPayload>(response);
}

export async function updateSourceImageDescription(
  sourceId: string | undefined,
  imageId: string,
  description: string,
) {
  const response = await fetch(
    `/api/library/source/${sourceId}/images/${imageId}/description`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description }),
    },
  );

  return parseResponse<LibrarySourceImage | ApiErrorPayload>(response);
}
