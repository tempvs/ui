export type ImageThumbnail = {
  id?: string | number | null;
  url?: string | null;
  thumbnailUrl?: string | null;
};

export type ResourceThumbnail = {
  resourceType: string;
  resourceId: string;
  image: ImageThumbnail | null;
};

const imageLookupBatchSize = 50;
const imageThumbnailCacheTtlMs = 2 * 60 * 1000;
const thumbnailCache = new Map<
  string,
  { thumbnail: ResourceThumbnail; expiresAt: number }
>();
const queuedThumbnailReads = new Map<string, ThumbnailRead>();
const inFlightThumbnailReads = new Map<string, ThumbnailRead>();
let thumbnailFlushScheduled = false;

type ThumbnailResource = {
  resourceType: string;
  resourceId: string;
};

type ThumbnailRead = {
  resource: ThumbnailResource;
  waiters: Array<{
    resolve: (thumbnail: ResourceThumbnail | null) => void;
    reject: (reason: unknown) => void;
  }>;
};

/**
 * Fetch first images for resources through one page-wide request queue. Cards
 * mounted together (feeds and embedded maps) share 50-resource API calls and
 * recently resolved thumbnails rather than creating one lookup per card.
 */
export async function getImageThumbnails(
  resources: Array<{ resourceType: string; resourceId: string | number }>,
): Promise<ResourceThumbnail[]> {
  const unique = Array.from(
    new Map(
      resources.map((resource) => [
        thumbnailKey(resource.resourceType, String(resource.resourceId)),
        {
          resourceType: resource.resourceType,
          resourceId: String(resource.resourceId),
        },
      ]),
    ).values(),
  );
  const thumbnails = await Promise.all(unique.map(readThumbnailBatched));
  return thumbnails.filter(
    (thumbnail): thumbnail is ResourceThumbnail => Boolean(thumbnail),
  );
}

function readThumbnailBatched(
  resource: ThumbnailResource,
): Promise<ResourceThumbnail | null> {
  const key = thumbnailKey(resource.resourceType, resource.resourceId);
  const cached = thumbnailCache.get(key);
  if (cached && cached.expiresAt > Date.now())
    return Promise.resolve(cached.thumbnail);
  if (cached) thumbnailCache.delete(key);
  return new Promise<ResourceThumbnail | null>((resolve, reject) => {
    const existing =
      queuedThumbnailReads.get(key) || inFlightThumbnailReads.get(key);
    if (existing) {
      existing.waiters.push({ resolve, reject });
      return;
    }
    queuedThumbnailReads.set(key, {
      resource,
      waiters: [{ resolve, reject }],
    });
    scheduleThumbnailFlush();
  });
}

function scheduleThumbnailFlush() {
  if (thumbnailFlushScheduled) return;
  thumbnailFlushScheduled = true;
  queueMicrotask(() => void flushThumbnailReads());
}

async function flushThumbnailReads() {
  thumbnailFlushScheduled = false;
  const entries = Array.from(queuedThumbnailReads.entries()).slice(
    0,
    imageLookupBatchSize,
  );
  if (!entries.length) return;
  entries.forEach(([key, read]) => {
    queuedThumbnailReads.delete(key);
    inFlightThumbnailReads.set(key, read);
  });
  try {
    const response = await fetch("/api/images/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resources: entries.map(([, read]) => read.resource),
      }),
    });
    if (!response.ok)
      throw new Error(`Image thumbnail lookup failed (${response.status})`);
    const payload = (await response.json()) as { content?: ResourceThumbnail[] };
    const byResource = new Map(
      (Array.isArray(payload.content) ? payload.content : []).map((thumbnail) => [
        thumbnailKey(thumbnail.resourceType, thumbnail.resourceId),
        thumbnail,
      ]),
    );
    entries.forEach(([key, read]) => {
      const thumbnail = byResource.get(key) || null;
      if (thumbnail)
        thumbnailCache.set(key, {
          thumbnail,
          expiresAt: Date.now() + imageThumbnailCacheTtlMs,
        });
      inFlightThumbnailReads.delete(key);
      read.waiters.forEach(({ resolve }) => resolve(thumbnail));
    });
  } catch (error) {
    entries.forEach(([key, read]) => {
      inFlightThumbnailReads.delete(key);
      read.waiters.forEach(({ reject }) => reject(error));
    });
  } finally {
    if (queuedThumbnailReads.size) scheduleThumbnailFlush();
  }
}

function thumbnailKey(resourceType: string, resourceId: string) {
  return `${resourceType}:${resourceId}`;
}
