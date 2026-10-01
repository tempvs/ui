import React, { useMemo, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import TextFilterInput from '../../component/TextFilterInput';
import { buildProfileLabel } from '../currentProfile';
import { Profile } from '../profileTypes';
import ProfileList from './ProfileList';

type Props = {
  title: string;
  profiles: Profile[];
  filterPlaceholder: string;
  emptyText: string;
  noMatchesText?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onReachEnd?: () => void;
  className?: string;
  renderActions?: (profile: Profile) => React.ReactNode;
};

/** Shared filtered profile section used by club and event people lists. */
export default function ProfileCollectionPanel({
  title,
  profiles,
  filterPlaceholder,
  emptyText,
  noMatchesText = 'No profiles match this filter.',
  loading = false,
  error = '',
  onRetry,
  onReachEnd,
  className,
  renderActions,
}: Props) {
  const [filter, setFilter] = useState('');
  const visibleProfiles = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    return query
      ? profiles.filter(profile => buildProfileLabel(profile).toLocaleLowerCase().includes(query))
      : profiles;
  }, [filter, profiles]);

  return <section className={['club-panel', className].filter(Boolean).join(' ')}>
    <div className="club-list-heading">
      <h2>{title}</h2>
      <TextFilterInput value={filter} onChange={setFilter} placeholder={filterPlaceholder} ariaLabel={filterPlaceholder} className="club-list-filter" />
    </div>
    {error && <Alert variant="danger">{error} {onRetry && <Button variant="link" onClick={onRetry}>Retry</Button>}</Alert>}
    {!loading && !error && profiles.length === 0 && <p>{emptyText}</p>}
    {!loading && !error && profiles.length > 0 && visibleProfiles.length === 0 && <p>{noMatchesText}</p>}
    <div className="club-scroll-list" role="region" aria-label={title} onScroll={event => {
      const element = event.currentTarget;
      if (onReachEnd && element.scrollTop + element.clientHeight >= element.scrollHeight - 80) onReachEnd();
    }}>
      <ProfileList profiles={visibleProfiles} className="club-member-list" renderActions={renderActions} />
      {loading && <p role="status" className="text-muted mb-2">Loading…</p>}
    </div>
  </section>;
}
