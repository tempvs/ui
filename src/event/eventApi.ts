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

export type EventApplication = {
  id: string;
  eventId: string;
  occurrenceId: string;
  profileId?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  attendees: Array<{ profileId: string; response: 'ATTENDING' | 'TENTATIVE' | 'NOT_ATTENDING' }>;
};

export type EventImage = { id: string; url?: string; thumbnailUrl?: string; description?: string | null; status?: string };

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
  applicationOccurrenceId?: string;
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

export async function getEventFollowState(eventId: string, profileId: string) {
  const value = await request<{ following?: boolean }>(`/${encodeURIComponent(eventId)}/follow-state?asProfileId=${encodeURIComponent(profileId)}`);
  return value.following === true;
}

export function followEvent(eventId: string, profileId: string) {
  return request<void>(`/${encodeURIComponent(eventId)}/followers/${encodeURIComponent(profileId)}`, { method: 'PUT' });
}

export function unfollowEvent(eventId: string, profileId: string) {
  return request<void>(`/${encodeURIComponent(eventId)}/followers/${encodeURIComponent(profileId)}`, { method: 'DELETE' });
}

export function getFollowedEvents(profileId: string) {
  return request<EventList>(`/profiles/${encodeURIComponent(profileId)}/followed-events`);
}

export function getParticipatingEvents(profileId: string) {
  return request<EventList>(`/profiles/${encodeURIComponent(profileId)}/participating-events`);
}

export async function getEventApplication(eventId: string, occurrenceId: string, profileId: string) {
  const value = await request<{ application: EventApplication | null }>(`/${encodeURIComponent(eventId)}/application-state?occurrenceId=${encodeURIComponent(occurrenceId)}&asProfileId=${encodeURIComponent(profileId)}`);
  return value.application;
}

export function applyForEvent(eventId: string, occurrenceId: string, profileId: string, response: 'ATTENDING' | 'TENTATIVE' = 'TENTATIVE') {
  return request<EventApplication>(`/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(occurrenceId)}/profile-applications`, {
    method: 'POST', body: JSON.stringify({ profileId, response }),
  });
}

export function cancelEventApplication(eventId: string, occurrenceId: string, profileId: string) {
  return request<void>(`/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(occurrenceId)}/profile-applications/${encodeURIComponent(profileId)}`, { method: 'DELETE' });
}

async function imageRequest<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api/images/event/${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message || `Image request failed (${response.status})`);
  return body as T;
}

export async function getEventImages(eventId: string): Promise<EventImage[]> {
  const value = await imageRequest<{ content?: EventImage[] }>(`${encodeURIComponent(eventId)}?limit=1`);
  return value.content || [];
}

export async function uploadEventImage(eventId: string, file: File): Promise<EventImage> {
  const intent = await request<{ image: EventImage; upload: { method: string; url: string; headers: Record<string, string> } }>(`/${encodeURIComponent(eventId)}/image`, {
    method: 'POST', body: JSON.stringify({ fileName: file.name, contentType: file.type, byteSize: file.size }),
  });
  const uploaded = await fetch(intent.upload.url, { method: intent.upload.method, headers: intent.upload.headers, body: file });
  if (!uploaded.ok) throw new Error('The event picture could not be uploaded.');
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const images = await getEventImages(eventId);
    const ready = images.find(image => image.id === intent.image.id && image.status === 'READY');
    if (ready) return ready;
    await new Promise(resolve => window.setTimeout(resolve, 250));
  }
  throw new Error('The event picture is still processing. Try refreshing shortly.');
}

export function deleteEventImage(eventId: string, imageId: string) {
  return request<void>(`/${encodeURIComponent(eventId)}/image`, { method: 'DELETE', body: JSON.stringify({ imageId }) });
}
