import React, { useEffect, useRef, useState } from 'react';

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

async function refreshUrl(
  resourceType: string | null | undefined,
  resourceId: string | number | null | undefined,
  imageId: string | number | null | undefined,
  variant: 'display' | 'thumbnail',
) {
  if (!resourceType || resourceId == null) return null;

  const params = new URLSearchParams({ limit: '1' });
  if (imageId != null) params.set('imageIds', String(imageId));
  const response = await fetch(
    `/api/images/${encodeURIComponent(resourceType)}/${encodeURIComponent(String(resourceId))}?${params}`,
  );
  if (!response.ok) return null;
  const page = await response.json() as { content?: ImageReference[] };
  const refreshed = page.content?.[0];
  return refreshed ? initialUrl(refreshed, variant) : null;
}

export default function RefreshingImage({
  image,
  variant = 'display',
  fallbackSrc,
  alt,
  onError,
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
    if (source || imageId == null) return;
    let active = true;
    void refreshUrl(resourceType, resourceId, imageId, variant).then(url => {
      if (active && url) setCurrentSource(url);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [source, imageId, resourceType, resourceId, variant]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = event => {
    onError?.(event);
    if (retried.current) {
      if (fallbackSrc && currentSource !== fallbackSrc) setCurrentSource(fallbackSrc);
      return;
    }
    retried.current = true;
    void refreshUrl(resourceType, resourceId, imageId, variant).then(url => {
      if (url && url !== currentSource) setCurrentSource(url);
      else if (fallbackSrc) setCurrentSource(fallbackSrc);
    }).catch(() => {
      if (fallbackSrc) setCurrentSource(fallbackSrc);
    });
  };

  return <img {...imgProps} src={currentSource || fallbackSrc} alt={alt} onError={handleError} />;
}
