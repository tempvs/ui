import React, { useMemo, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';

import TextFilterInput from '../../component/TextFilterInput';

type Props<T> = {
  title: string;
  items: T[];
  loaded: boolean;
  filterPlaceholder: string;
  getSearchText: (item: T) => string;
  renderItems: (items: T[]) => React.ReactNode;
  emptyText: string;
  noMatchesText: string;
  error?: string;
  onRetry?: () => void;
  actions?: React.ReactNode;
  className?: string;
};

/** Shared filtered section used for profile following and membership relationships. */
export default function ProfileRelationshipPanel<T>({
  title,
  items,
  loaded,
  filterPlaceholder,
  getSearchText,
  renderItems,
  emptyText,
  noMatchesText,
  error = '',
  onRetry,
  actions,
  className,
}: Props<T>) {
  const [filter, setFilter] = useState('');
  const visibleItems = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    return query
      ? items.filter(item => getSearchText(item).toLocaleLowerCase().includes(query))
      : items;
  }, [filter, getSearchText, items]);

  return <section
    className={['club-panel', 'profile-relationship-panel', className].filter(Boolean).join(' ')}
    aria-label={title}
  >
    <div className="profile-relationship-heading">
      <h3>{title}</h3>
      <TextFilterInput
        value={filter}
        onChange={setFilter}
        placeholder={filterPlaceholder}
        ariaLabel={filterPlaceholder}
        className="club-list-filter profile-relationship-filter"
      />
      <div className="profile-relationship-actions">{actions}</div>
    </div>

    {error && <Alert variant="danger" className="mt-3 mb-0">
      {error} {onRetry && <Button variant="link" onClick={onRetry}>Retry</Button>}
    </Alert>}
    {!loaded && <p role="status" className="text-muted mt-3 mb-0">Loading...</p>}
    {loaded && !error && items.length === 0 && <p className="text-muted mt-3 mb-0">{emptyText}</p>}
    {loaded && !error && items.length > 0 && visibleItems.length === 0 && <p className="text-muted mt-3 mb-0">{noMatchesText}</p>}
    {loaded && !error && visibleItems.length > 0 && renderItems(visibleItems)}
  </section>;
}
