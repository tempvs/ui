import { Period } from '../util/periods';

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type EventSchedule = {
  kind: 'ONE_TIME' | 'RECURRING';
  startsAt: string;
  endsAt: string;
  timeZone: string;
  recurrence?: {
    frequency: RecurrenceFrequency;
    interval: number;
    count?: number;
    until?: string;
  };
};

export type EventOccurrence = {
  id: string;
  eventId: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
};

export type TempvsEvent = {
  id: string;
  ownerProfileId: string;
  adminProfileIds: string[];
  name: string;
  description: string | null;
  periods: Period[];
  schedule: EventSchedule;
  image: null | { id: string; url: string; thumbnailUrl?: string; description: string | null };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
  upcomingOccurrences?: EventOccurrence[];
};

export type EventDraft = Pick<TempvsEvent, 'ownerProfileId' | 'name' | 'description' | 'periods' | 'schedule'>;

type EventList = { content: TempvsEvent[]; nextToken?: string };

function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.()
    ?? `event-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/events${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(body?.message || `Event request failed (${response.status})`);
  }
  return body as T;
}

export function listEvents(signal?: AbortSignal) {
  return request<EventList>('', { signal });
}

export function getEvent(eventId: string, signal?: AbortSignal) {
  return request<TempvsEvent>(`/${encodeURIComponent(eventId)}`, { signal });
}

export function createEvent(draft: EventDraft) {
  return request<TempvsEvent>('', {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(draft),
  });
}

export function updateEvent(eventId: string, draft: EventDraft, version: number) {
  return request<TempvsEvent>(`/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    body: JSON.stringify({ ...draft, version }),
  });
}

export function deleteEvent(eventId: string) {
  return request<void>(`/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
}

export function addEventAdmin(eventId: string, profileId: string) {
  return request<TempvsEvent>(`/${encodeURIComponent(eventId)}/admins`, {
    method: 'POST',
    body: JSON.stringify({ profileId }),
  });
}

export function removeEventAdmin(eventId: string, profileId: string) {
  return request<TempvsEvent>(`/${encodeURIComponent(eventId)}/admins/${encodeURIComponent(profileId)}`, {
    method: 'DELETE',
  });
}
