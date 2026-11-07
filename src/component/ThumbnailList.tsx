import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { DEFAULT_HOURGLASS_IMAGE_SRC } from './DefaultHourglassImage';
import RefreshingImage, { ImageReference } from '../image/RefreshingImage';
import './ThumbnailList.css';

const InsideList = createContext(false);
const PAGE_SIZE = 9;
const PREFETCH_ROWS = 2;

type ViewportProps<T> = {
  items: T[];
  renderItems: (items: T[]) => React.ReactNode;
  label?: string;
  loading?: boolean;
  onReachEnd?: () => void;
};

/** Three visible rows, with the next page mounted/fetched two rows before the end. */
export function ThumbnailListViewport<T>({ items, renderItems, label, loading = false, onReachEnd }: ViewportProps<T>) {
  const nested = useContext(InsideList);
  const viewport = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const renderedCount = Math.min(limit, items.length);
  const checkPosition = useCallback(() => {
    const element = viewport.current;
    if (!element || loading) return;
    const row = element.querySelector<HTMLElement>('.thumbnail-list-row');
    const rowHeight = row?.getBoundingClientRect().height || 64;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining > rowHeight * PREFETCH_ROWS) return;
    if (renderedCount < items.length) setLimit(value => value <= renderedCount ? value + PAGE_SIZE : value);
    // Fetch before the locally mounted buffer is exhausted as well.
    if (items.length - renderedCount < PAGE_SIZE) onReachEnd?.();
  }, [items.length, loading, onReachEnd, renderedCount]);

  useEffect(() => {
    if (nested) return;
    // Skip collapsed viewports; refill visible lists after a short/empty page.
    if (viewport.current?.clientHeight) checkPosition();
  }, [checkPosition, nested]);

  if (nested) return <>{renderItems(items)}</>;
  return <div ref={viewport} className="thumbnail-list-viewport club-scroll-list" role={label ? 'region' : undefined}
    aria-label={label} tabIndex={0} onScroll={checkPosition}>
    <InsideList.Provider value>{renderItems(items.slice(0, limit))}</InsideList.Provider>
  </div>;
}

type ListProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  className?: string;
  label?: string;
  loading?: boolean;
  onReachEnd?: () => void;
};

/** All compact entity lists share the same row geometry and scroll behavior. */
export default function ThumbnailList<T>({ items, getKey, renderItem, className, label, loading, onReachEnd }: ListProps<T>) {
  return <ThumbnailListViewport items={items} label={label} loading={loading} onReachEnd={onReachEnd}
    renderItems={visible => <ul className={['thumbnail-list', className].filter(Boolean).join(' ')}>
      {visible.map(item => <li className="thumbnail-list-row" key={getKey(item)}>{renderItem(item)}</li>)}
    </ul>} />;
}

type EntryProps = {
  label: React.ReactNode;
  image: ImageReference;
  to?: string;
  onClick?: () => void;
  meta?: React.ReactNode;
  className?: string;
  imageClassName?: string;
  displayLabel?: boolean;
};

export function ThumbnailEntry({ label, image, to, onClick, meta, className, imageClassName, displayLabel = true }: EntryProps) {
  const classes = ['thumbnail-entry', className].filter(Boolean).join(' ');
  const content = <>
    <RefreshingImage image={image} variant="thumbnail" fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC}
      className={['thumbnail-entry-image', imageClassName].filter(Boolean).join(' ')} alt="" loading="lazy" />
    {displayLabel && <span className="thumbnail-entry-copy"><span>{label}</span>{meta && <small>{meta}</small>}</span>}
  </>;
  return to ? <Link className={classes} to={to}>{content}</Link>
    : <button type="button" className={classes} onClick={onClick}>{content}</button>;
}
