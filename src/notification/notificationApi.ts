export const NOTIFICATIONS_CHANGED = 'tempvs:notifications-changed';
const notifyChanged = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

export type Notification = {
  id: string;
  eventId: string;
  type: string;
  category: "PROFILE" | "CLUB" | "EVENT" | "LIBRARY" | "MAP";
  createdAt: string;
  title: string;
  summary?: string;
  path: string;
  actorProfileId?: string;
  references?: NotificationReference[];
  readAt?: string;
};

export type NotificationReference = {
  type: "PROFILE" | "CLUB" | "EVENT";
  id: string;
  label: string;
  path: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/notification${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok)
    throw new Error(
      body?.message || `Notification request failed (${response.status})`,
    );
  return body as T;
}

export function listNotifications(
  status: "all" | "unread" = "all",
  nextToken?: string,
  category?: Notification["category"],
) {
  const query = new URLSearchParams({ status, limit: "30" });
  if (nextToken) query.set("nextToken", nextToken);
  if (category) query.set("category", category);
  return request<{ content: Notification[]; nextToken?: string }>(`?${query}`);
}

export function getUnreadNotificationCount() {
  return request<{ count: number }>("/unread-count");
}

export function readNotification(id: string) {
  return request<Notification>(`/${encodeURIComponent(id)}/read`, {
    method: "POST",
  }).finally(notifyChanged);
}

export async function readAllNotifications() {
  try {
  let marked = 0;
  let nextToken: string | undefined;
  do {
    const page: { marked: number; hasMore?: boolean; nextToken?: string } = await request(
      `/read-all?${new URLSearchParams({ paged: "true", ...(nextToken ? { nextToken } : {}) })}`, { method: "POST" },
    );
    marked += page.marked;
    if (page.hasMore && (!page.nextToken || page.nextToken === nextToken)) throw new Error("Notification read-all did not advance. Retry the action.");
    nextToken = page.hasMore ? page.nextToken : undefined;
  } while (nextToken);
  return { marked };
  } finally { notifyChanged(); }
}

export function archiveNotification(id: string) {
  return request<void>(`/${encodeURIComponent(id)}`, { method: "DELETE" }).finally(notifyChanged);
}
