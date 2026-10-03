export type CommentTargetType = "POST" | "IMAGE";

export type Comment = {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  authorProfileId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/comment${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => undefined) as { message?: string } | undefined;
  if (!response.ok) throw new Error(body?.message || "Unable to complete the comment request.");
  return body as T;
}

export function listComments(targetType: CommentTargetType, targetId: string | number) {
  return request<{ content: Comment[] }>(`/comments?${new URLSearchParams({ targetType, targetId: String(targetId) })}`);
}

export function createComment(targetType: CommentTargetType, targetId: string | number, authorProfileId: string, content: string) {
  return request<Comment>("/comments", { method: "POST", body: JSON.stringify({ targetType, targetId: String(targetId), authorProfileId, content }) });
}

export function updateComment(commentId: string, content: string) {
  return request<Comment>(`/comments/${encodeURIComponent(commentId)}`, { method: "PUT", body: JSON.stringify({ content }) });
}

export function deleteComment(commentId: string) {
  return request<void>(`/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" });
}
