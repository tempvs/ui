import React, { useEffect, useRef, useState } from 'react';
import { FaHourglassHalf } from 'react-icons/fa';

export type ImageReference = {
  id?: string | number | null;
  url?: string | null;
  thumbnailUrl?: string | null;
  resourceType?: string | null;
  resourceId?: string | number | null;
  belongsTo?: string | null;
  entityId?: string | number | null;
};

type RefreshingImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  image: ImageReference;
  alt: string;
  variant?: 'display' | 'thumbnail';
  fallbackSrc?: string;
};

function initialUrl(image: ImageReference, variant: 'display' | 'thumbnail') {
  return variant === 'thumbnail'
    ? image.thumbnailUrl || image.url || ''
    : image.url || image.thumbnailUrl || '';
}

const IMAGE_REFRESH_INTERVAL_MS = 750;
const IMAGE_REFRESH_ATTEMPTS = 40;
const IMAGE_METADATA_CACHE_MS = 10_000;
const SavingIcon = FaHourglassHalf as React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

type CachedImageRead = {
  expiresAt: number;
  request: Promise<ImageReference | null>;
};

// The same image can be rendered in the page body and a navigation/admin
// tile at once. Share that metadata lookup across all RefreshingImage
// instances; a missing pending image is deliberately not cached so uploads
// can still be observed promptly.
const imageMetadataReads = new Map<string, CachedImageRead>();

function readImageMetadata(
  resourceType: string,
  resourceId: string | number,
  imageId: string | number | null | undefined,
): Promise<ImageReference | null> {
  const key = `${resourceType}:${resourceId}:${imageId ?? ''}`;
  const now = Date.now();
  const existing = imageMetadataReads.get(key);
  if (existing && existing.expiresAt > now) return existing.request;

  const params = new URLSearchParams({ limit: '1' });
  if (imageId != null) params.set('imageIds', String(imageId));
  const request = fetch(
    `/api/images/${encodeURIComponent(resourceType)}/${encodeURIComponent(String(resourceId))}?${params}`,
  ).then(async response => {
    if (!response.ok) return null;
    const page = await response.json() as { content?: ImageReference[] };
    return page.content?.[0] || null;
  });
  const entry: CachedImageRead = { request, expiresAt: now + IMAGE_METADATA_CACHE_MS };
  imageMetadataReads.set(key, entry);
  request.then(
    image => {
      // Pending/absent images need a later retry. A published image with an
      // actual URL can be safely reused for this short page-session window.
      if ((!image || (!image.url && !image.thumbnailUrl)) && imageMetadataReads.get(key) === entry) {
        imageMetadataReads.delete(key);
      }
    },
    () => {
      if (imageMetadataReads.get(key) === entry) imageMetadataReads.delete(key);
    },
  );
  return request;
}

async function refreshUrl(
  resourceType: string | null | undefined,
  resourceId: string | number | null | undefined,
  imageId: string | number | null | undefined,
  variant: 'display' | 'thumbnail',
): Promise<{ url: string | null; pending: boolean }> {
  if (!resourceType || resourceId == null) return { url: null, pending: false };
  const refreshed = await readImageMetadata(resourceType, resourceId, imageId);
  const url = refreshed ? initialUrl(refreshed, variant) : null;
  return {
    url,
    // A known image with no published URL is the upload-processing case.
    // Empty/error responses are not pending uploads and must not be polled.
    pending: imageId != null && refreshed != null && !url,
  };
}

export default function RefreshingImage({
  image,
  variant = 'display',
  fallbackSrc,
  alt,
  onError,
  className,
  style,
  ...imgProps
}: RefreshingImageProps) {
  const source = initialUrl(image, variant);
  const imageId = image.id;
  const resourceType = image.resourceType || image.belongsTo;
  const resourceId = image.resourceId ?? image.entityId;
  const [currentSource, setCurrentSource] = useState(source);
  const retried = useRef(false);

  useEffect(() => {
    setCurrentSource(source);
    retried.current = false;
    if (source || !resourceType || resourceId == null) return;
    let active = true;
    let retryTimer: number | undefined;

    const refreshPendingImage = async (attempt: number): Promise<void> => {
      let pending = false;
      try {
        const result = await refreshUrl(resourceType, resourceId, imageId, variant);
        if (!active) return;
        if (result.url) {
          setCurrentSource(result.url);
          return;
        }
        pending = result.pending;
      } catch {
        // A service failure is not evidence of an upload in progress.
      }

      // A known image ID represents a pending upload and can be polled until
      // the processor publishes it. A profile/club reference without an
      // image ID only needs one metadata lookup: repeatedly polling a profile
      // that simply has no avatar creates needless Lambda/API traffic.
      if (active && pending && attempt + 1 < IMAGE_REFRESH_ATTEMPTS) {
        retryTimer = window.setTimeout(() => {
          void refreshPendingImage(attempt + 1);
        }, IMAGE_REFRESH_INTERVAL_MS);
      }
    };

    void refreshPendingImage(0);
    return () => {
      active = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [source, imageId, resourceType, resourceId, variant]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = event => {
    onError?.(event);
    if (retried.current) {
      if (fallbackSrc && currentSource !== fallbackSrc) setCurrentSource(fallbackSrc);
      return;
    }
    retried.current = true;
    void refreshUrl(resourceType, resourceId, imageId, variant).then(result => {
      if (result.url && result.url !== currentSource) setCurrentSource(result.url);
      else if (fallbackSrc) setCurrentSource(fallbackSrc);
    }).catch(() => {
      if (fallbackSrc) setCurrentSource(fallbackSrc);
    });
  };

  if (!currentSource && !fallbackSrc) {
    return (
      <span
        className={className}
        role="status"
        aria-label={`Uploading ${alt}`}
        style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <SavingIcon aria-hidden={true} />
      </span>
    );
  }

  return <img {...imgProps} className={className} style={style} src={currentSource || fallbackSrc} alt={alt} onError={handleError} />;
}
