export type WallEntityType = 'PROFILE' | 'CLUB' | 'EVENT' | 'SOURCE';
export type WallReason = 'OWN_PROFILE' | 'FOLLOWED_PROFILE' | 'FOLLOWED_CLUB' | 'CLUB_MEMBER' | 'FOLLOWED_EVENT' | 'EVENT_PARTICIPANT' | 'SOURCE_USED';

export type WallTarget = { type: WallEntityType; id: string; reason: WallReason };

export type WallActivity = {
  id: string;
  eventType: string;
  occurredAt: string;
  producer: string;
  targetType: WallEntityType;
  targetId: string;
  actorProfileId?: string;
  title: string;
  summary?: string;
  path: string;
  edited?: boolean;
  changes?: Record<string, { before: string | null; after: string | null }>;
  reasons?: WallReason[];
};

export type WallPage = { content: WallActivity[]; hasMore: boolean; nextToken?: string };

export type ResourceThumbnail = {
  resourceType: string;
  resourceId: string;
  image: {
    id?: string | number | null;
    url?: string | null;
    thumbnailUrl?: string | null;
  } | null;
};

async function response<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const result = await fetch(input, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  if (!result.ok) {
    const body = await result.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message || `Wall request failed (${result.status})`);
  }
  if (result.status === 204) return undefined as T;
  return result.json() as Promise<T>;
}

export function getWall(profileId: string, targets: WallTarget[], nextToken?: string) {
  const params = new URLSearchParams({ profileId, limit: '20' });
  targets.forEach(target => params.append('target', `${target.type}:${target.id}:${target.reason}`));
  if (nextToken) params.set('nextToken', nextToken);
  return response<WallPage>(`/api/wall?${params}`);
}

export function dismissWallItem(profileId: string, activityId: string) {
  const params = new URLSearchParams({ profileId });
  return response<void>(`/api/wall/items/${encodeURIComponent(activityId)}?${params}`, { method: 'DELETE' });
}

/** One request for the visible wall page, rather than one image request per card. */
export function getWallThumbnails(resources: Array<{ resourceType: string; resourceId: string }>) {
  return response<{ content: ResourceThumbnail[] }>('/api/images/lookup', {
    method: 'POST',
    body: JSON.stringify({ resources }),
  });
}
