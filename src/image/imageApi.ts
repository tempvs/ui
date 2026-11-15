export type ImageThumbnail = {
  id?: string | number | null;
  url?: string | null;
  thumbnailUrl?: string | null;
};

export type ResourceThumbnail = {
  resourceType: string;
  resourceId: string;
  preferredImageId?: string;
  image: ImageThumbnail | null;
};

const imageLookupBatchSize = 50;
const imageThumbnailCacheTtlMs = 2 * 60 * 1000;
const missingThumbnailCacheTtlMs = 15_000;
const thumbnailCacheCapacity = 500;
const thumbnailCache = new Map<
  string,
  { thumbnail: ResourceThumbnail; expiresAt: number }
>();
const queuedThumbnailReads = new Map<string, ThumbnailRead>();
const inFlightThumbnailReads = new Map<string, ThumbnailRead>();
let thumbnailFlushScheduled = false;
let activeThumbnailBatches = 0;

type ThumbnailResource = {
  resourceType: string;
  resourceId: string;
  preferredImageId?: string;
};

type ThumbnailRead = {
  resource: ThumbnailResource;
  batch?: { controller: AbortController; reads: ThumbnailRead[] };
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
  resources: Array<{
    resourceType: string;
    resourceId: string | number;
    preferredImageId?: string;
  }>,
  signal?: AbortSignal,
): Promise<ResourceThumbnail[]> {
  signal?.throwIfAborted();
  const unique = Array.from(
    new Map(
      resources.map((resource) => [
        thumbnailKey(
          resource.resourceType,
          String(resource.resourceId),
          resource.preferredImageId?.toLowerCase(),
        ),
        {
          resourceType: resource.resourceType,
          resourceId: String(resource.resourceId),
          ...(resource.preferredImageId
            ? { preferredImageId: resource.preferredImageId.toLowerCase() }
            : {}),
        },
      ]),
    ).values(),
  );
  const thumbnails = await Promise.all(unique.map((resource) => readThumbnailBatched(resource, signal)));
  return thumbnails.filter((thumbnail): thumbnail is ResourceThumbnail =>
    Boolean(thumbnail),
  );
}

function readThumbnailBatched(
  resource: ThumbnailResource,
  signal?: AbortSignal,
): Promise<ResourceThumbnail | null> {
  const key = thumbnailKey(
    resource.resourceType,
    resource.resourceId,
    resource.preferredImageId,
  );
  const cached = thumbnailCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    thumbnailCache.delete(key);
    thumbnailCache.set(key, cached);
    return Promise.resolve(cached.thumbnail);
  }
  if (cached) thumbnailCache.delete(key);
  return new Promise<ResourceThumbnail | null>((resolve, reject) => {
    let read =
      queuedThumbnailReads.get(key) || inFlightThumbnailReads.get(key);
    if (!read) {
      read = { resource, waiters: [] };
      queuedThumbnailReads.set(key, read);
      scheduleThumbnailFlush();
    }
    const current = read;
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const waiter = {
      resolve: (value: ResourceThumbnail | null) => { cleanup(); resolve(value); },
      reject: (error: unknown) => { cleanup(); reject(error); },
    };
    const abort = () => {
      current.waiters = current.waiters.filter((value) => value !== waiter);
      waiter.reject(signal?.reason);
      if (!current.waiters.length) {
        if (queuedThumbnailReads.get(key) === current) queuedThumbnailReads.delete(key);
        if (inFlightThumbnailReads.get(key) === current) inFlightThumbnailReads.delete(key);
        if (current.batch?.reads.every((value) => !value.waiters.length)) current.batch.controller.abort();
      }
    };
    current.waiters.push(waiter);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function scheduleThumbnailFlush() {
  if (thumbnailFlushScheduled) return;
  thumbnailFlushScheduled = true;
  queueMicrotask(() => void flushThumbnailReads());
}

async function flushThumbnailReads() {
  thumbnailFlushScheduled = false;
  if (activeThumbnailBatches >= 2) return;
  const entries = Array.from(queuedThumbnailReads.entries()).slice(
    0,
    imageLookupBatchSize,
  );
  if (!entries.length) return;
  activeThumbnailBatches++;
  const batch = { controller: new AbortController(), reads: entries.map(([, read]) => read) };
  entries.forEach(([key, read]) => {
    read.batch = batch;
    queuedThumbnailReads.delete(key);
    inFlightThumbnailReads.set(key, read);
  });
  if (queuedThumbnailReads.size) scheduleThumbnailFlush();
  try {
    const response = await fetch("/api/images/lookup", {
      method: "POST",
      signal: batch.controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resources: entries.map(([, read]) => read.resource),
      }),
    });
    if (!response.ok)
      throw new Error(`Image thumbnail lookup failed (${response.status})`);
    const payload = (await response.json()) as {
      content?: ResourceThumbnail[];
    };
    const byResource = new Map(
      (Array.isArray(payload.content) ? payload.content : []).map(
        (thumbnail) => [
          thumbnailKey(
            thumbnail.resourceType,
            thumbnail.resourceId,
            thumbnail.preferredImageId,
          ),
          thumbnail,
        ],
      ),
    );
    entries.forEach(([key, read]) => {
      const thumbnail = byResource.get(key) || null;
      if (thumbnail && !batch.controller.signal.aborted) {
        // Sweep stale entries as well as bounding retained, recently used ones.
        for (const [id, value] of thumbnailCache)
          if (value.expiresAt <= Date.now()) thumbnailCache.delete(id);
        thumbnailCache.delete(key);
        thumbnailCache.set(key, {
          thumbnail,
          expiresAt: Date.now() + (thumbnail.image ? imageThumbnailCacheTtlMs : missingThumbnailCacheTtlMs),
        });
        while (thumbnailCache.size > thumbnailCacheCapacity) thumbnailCache.delete(thumbnailCache.keys().next().value!);
      }
      if (inFlightThumbnailReads.get(key) === read) inFlightThumbnailReads.delete(key);
      read.waiters.forEach(({ resolve }) => resolve(thumbnail));
    });
  } catch (error) {
    entries.forEach(([key, read]) => {
      if (inFlightThumbnailReads.get(key) === read) inFlightThumbnailReads.delete(key);
      read.waiters.forEach(({ reject }) => reject(error));
    });
  } finally {
    activeThumbnailBatches--;
    if (queuedThumbnailReads.size) scheduleThumbnailFlush();
  }
}

function thumbnailKey(
  resourceType: string,
  resourceId: string,
  preferredImageId?: string,
) {
  // A cover image and the first image of the same resource are different
  // representations. Neither cache entry may satisfy the other lookup.
  return JSON.stringify([resourceType, resourceId, preferredImageId || null]);
}
