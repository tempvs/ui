import React from 'react';

import { buildProfileLabel } from '../currentProfile';
import { Profile } from '../profileTypes';
import ProfileList from './ProfileList';
import ProfileRelationshipPanel from './ProfileRelationshipPanel';

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
  filter?: string;
  onFilterChange?: (value: string) => void;
};

/** Shared filtered profile section used by profile, club, and event people lists. */
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
  filter,
  onFilterChange,
}: Props) {
  return <ProfileRelationshipPanel
    title={title}
    items={profiles}
    loaded={!loading || profiles.length > 0}
    filterPlaceholder={filterPlaceholder}
    getSearchText={profile => buildProfileLabel(profile)}
    emptyText={emptyText}
    noMatchesText={noMatchesText}
    error={error}
    onRetry={onRetry}
    className={className}
    filter={filter}
    onFilterChange={onFilterChange}
    contentRegionLabel={title}
    renderItems={visibleProfiles => <div className="club-scroll-list" role="region" aria-label={title} onScroll={event => {
      const element = event.currentTarget;
      if (onReachEnd && element.scrollTop + element.clientHeight >= element.scrollHeight - 80) onReachEnd();
    }}>
      <ProfileList profiles={visibleProfiles} className="club-member-list" renderActions={renderActions} />
      {loading && <p role="status" className="text-muted mb-2">Loading…</p>}
    </div>}
  />;
}
