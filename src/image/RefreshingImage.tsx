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

async function refreshUrl(image: ImageReference, variant: 'display' | 'thumbnail') {
  const resourceType = image.resourceType || image.belongsTo;
  const resourceId = image.resourceId ?? image.entityId;
  if (!resourceType || resourceId == null) return null;

  const params = new URLSearchParams({ limit: '1' });
  if (image.id != null) params.set('imageIds', String(image.id));
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
  const [currentSource, setCurrentSource] = useState(source);
  const retried = useRef(false);

  useEffect(() => {
    setCurrentSource(source);
    retried.current = false;
  }, [source, image.id, image.resourceType, image.resourceId, image.belongsTo, image.entityId, variant]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = event => {
    onError?.(event);
    if (retried.current) {
      if (fallbackSrc && currentSource !== fallbackSrc) setCurrentSource(fallbackSrc);
      return;
    }
    retried.current = true;
    void refreshUrl(image, variant).then(url => {
      if (url && url !== currentSource) setCurrentSource(url);
      else if (fallbackSrc) setCurrentSource(fallbackSrc);
    }).catch(() => {
      if (fallbackSrc) setCurrentSource(fallbackSrc);
    });
  };

  return <img {...imgProps} src={currentSource || fallbackSrc} alt={alt} onError={handleError} />;
}
