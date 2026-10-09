export type Notification = {
  id: string;
  eventId: string;
  type: string;
  category: 'PROFILE' | 'CLUB' | 'EVENT' | 'LIBRARY' | 'MAP';
  createdAt: string;
  title: string;
  summary?: string;
  path: string;
  actorProfileId?: string;
  readAt?: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/notification${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok)
    throw new Error(body?.message || `Notification request failed (${response.status})`);
  return body as T;
}

export function listNotifications(status: 'all' | 'unread' = 'all', nextToken?: string) {
  const query = new URLSearchParams({ status, limit: '30' });
  if (nextToken) query.set('nextToken', nextToken);
  return request<{ content: Notification[]; nextToken?: string }>(`?${query}`);
}

export function getUnreadNotificationCount() {
  return request<{ count: number }>('/unread-count');
}

export function readNotification(id: string) {
  return request<Notification>(`/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

export function readAllNotifications() {
  return request<{ marked: number }>('/read-all', { method: 'POST' });
}

export function archiveNotification(id: string) {
  return request<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
