export type CommentTargetType = "POST" | "IMAGE" | "SOURCE_CHANGESET";

export type Comment = {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  authorProfileId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
  mapReference?: import("../map/MapReferenceAttachment").PublicMapReference;
};
export type CommentPage = { content: Comment[]; nextToken?: string | null };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // The edge route represents the comments collection itself; keeping the
  // browser path singular prevents `/comments/comments` upstream paths.
  const route = path === "/comments" ? "" : path.replace(/^\/comments/, "");
  const response = await fetch(`/api/comment${route}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => undefined)) as
    { message?: string } | undefined;
  if (!response.ok)
    throw new Error(body?.message || "Unable to complete the comment request.");
  return body as T;
}

export function listComments(
  targetType: CommentTargetType,
  targetId: string | number,
  nextToken?: string | null,
) {
  const query = new URLSearchParams({
    targetType,
    targetId: String(targetId),
  });
  if (nextToken) query.set("nextToken", nextToken);
  return request<CommentPage>(`/comments?${query}`);
}

export function listCommentsBatch(
  targetType: CommentTargetType,
  targetIds: readonly (string | number)[],
) {
  const ids = Array.from(new Set(targetIds.map(String).filter(Boolean)));
  if (!ids.length)
    return Promise.resolve(
      {} as Record<string, { content: Comment[]; nextToken?: string | null }>,
    );
  return request<{
    itemsByTargetId: Record<
      string,
      { content: Comment[]; nextToken?: string | null }
    >;
  }>(
    `/comments/batch?${new URLSearchParams({ targetType, targetIds: ids.join(",") })}`,
  ).then((result) => result.itemsByTargetId);
}

export function createComment(
  targetType: CommentTargetType,
  targetId: string | number,
  authorProfileId: string,
  content: string,
  mapReference?: Comment["mapReference"],
) {
  return request<Comment>("/comments", {
    method: "POST",
    body: JSON.stringify({
      targetType,
      targetId: String(targetId),
      authorProfileId,
      content,
      ...(mapReference ? { mapReference } : {}),
    }),
  });
}

export function updateComment(commentId: string, content: string) {
  return request<Comment>(`/comments/${encodeURIComponent(commentId)}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export function deleteComment(commentId: string) {
  return request<void>(`/comments/${encodeURIComponent(commentId)}`, {
    method: "DELETE",
  });
}
