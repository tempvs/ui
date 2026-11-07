import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';

import TextFilterInput from '../../component/TextFilterInput';
import { ThumbnailListViewport } from '../../component/ThumbnailList';

type Props<T> = {
  title: string;
  titleContent?: React.ReactNode;
  items: T[];
  loaded: boolean;
  filterPlaceholder: string;
  getSearchText: (item: T) => string;
  renderItems: (items: T[]) => React.ReactNode;
  emptyText: string;
  noMatchesText: string;
  error?: string;
  onRetry?: () => void;
  className?: string;
  headerAction?: React.ReactNode;
  hideWhenEmpty?: boolean;
  filter?: string;
  onFilterChange?: (value: string) => void;
  contentRegionLabel?: string;
  loadingMore?: boolean;
  onReachEnd?: () => void;
};

/** Shared filtered section used for profile following and membership relationships. */
export default function ProfileRelationshipPanel<T>({
  title,
  titleContent,
  items,
  loaded,
  filterPlaceholder,
  getSearchText,
  renderItems,
  emptyText,
  noMatchesText,
  error = '',
  onRetry,
  className,
  headerAction,
  hideWhenEmpty = false,
  filter,
  onFilterChange,
  contentRegionLabel,
  loadingMore = false,
  onReachEnd,
}: Props<T>) {
  const [localFilter, setLocalFilter] = useState('');
  const activeFilter = filter ?? localFilter;
  const setFilter = onFilterChange ?? setLocalFilter;
  const visibleItems = useMemo(() => {
    const query = activeFilter.trim().toLocaleLowerCase();
    return query
      ? items.filter(item => getSearchText(item).toLocaleLowerCase().includes(query))
      : items;
  }, [activeFilter, getSearchText, items]);

  useEffect(() => {
    // A sparse filter result may need another server page before it can scroll.
    if (loaded && !loadingMore && !error && visibleItems.length <= 5) onReachEnd?.();
  }, [loaded, loadingMore, error, visibleItems.length, onReachEnd]);

  if (hideWhenEmpty && (!loaded || (!error && items.length === 0))) return null;

  return <section
    className={['club-panel', 'profile-relationship-panel', className].filter(Boolean).join(' ')}
    aria-label={contentRegionLabel ? undefined : title}
  >
    <div className="profile-relationship-heading">
      <h3>{titleContent ?? title}</h3>
      <div className="profile-relationship-heading-controls">
        <TextFilterInput
          value={activeFilter}
          onChange={setFilter}
          placeholder={filterPlaceholder}
          ariaLabel={filterPlaceholder}
          className="club-list-filter profile-relationship-filter"
        />
        {headerAction}
      </div>
    </div>

    {error && <Alert variant="danger" className="mt-3 mb-0">
      {error} {onRetry && <Button variant="link" onClick={onRetry}>Retry</Button>}
    </Alert>}
    {!loaded && <p role="status" className="text-muted mt-3 mb-0">Loading...</p>}
    {loaded && !loadingMore && !onReachEnd && !error && items.length === 0 && <p className="text-muted mt-3 mb-0">{emptyText}</p>}
    {loaded && !loadingMore && !onReachEnd && !error && items.length > 0 && visibleItems.length === 0 && <p className="text-muted mt-3 mb-0">{noMatchesText}</p>}
    {loaded && visibleItems.length > 0 && <ThumbnailListViewport key={activeFilter} items={visibleItems}
      label={contentRegionLabel} loading={loadingMore} onReachEnd={error ? undefined : onReachEnd} renderItems={renderItems} />}
    {loaded && loadingMore && <p role="status" className="text-muted mt-2 mb-0">Loading…</p>}
  </section>;
}
