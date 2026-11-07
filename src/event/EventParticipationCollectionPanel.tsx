import React from 'react';

import ThumbnailList, { ThumbnailEntry } from '../component/ThumbnailList';
import { Club } from '../club/clubApi';
import { buildProfileLabel } from '../profile/currentProfile';
import ProfileThumbnailLink from '../profile/components/ProfileThumbnailLink';
import ProfileRelationshipPanel from '../profile/components/ProfileRelationshipPanel';
import { Profile } from '../profile/profileTypes';
import { EventApplication } from './eventApi';

type Props = {
  title: string;
  applications: EventApplication[];
  profilesById: Record<string, Profile>;
  clubsById: Record<string, Club>;
  filterPlaceholder: string;
  emptyText: string;
  noMatchesText?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  renderActions?: (application: EventApplication, profile: Profile) => React.ReactNode;
  renderClubActions?: (club: Club, applications: EventApplication[]) => React.ReactNode;
};

type ParticipationRow = { key: string; club?: Club | null; application?: EventApplication; applications: EventApplication[]; indented?: boolean };

/** Shared relationship section for hierarchical event participation: club, then its profiles. */
export default function EventParticipationCollectionPanel({
  title,
  applications,
  profilesById,
  clubsById,
  filterPlaceholder,
  emptyText,
  noMatchesText = 'No participation records match this filter.',
  loading = false,
  error = '',
  onRetry,
  renderActions,
  renderClubActions,
}: Props) {
  const profileFor = (application: EventApplication) => application.profileId
    ? profilesById[String(application.profileId)]
    : undefined;
  const grouped = new Map<string, EventApplication[]>();
  applications.filter(application => application.clubId).forEach(application => {
    const id = String(application.clubId);
    grouped.set(id, [...(grouped.get(id) || []), application]);
  });
  const rows: ParticipationRow[] = applications.filter(application => !application.clubId)
    .map(application => ({ key: application.id, application, applications: [application] }));
  grouped.forEach((values, id) => {
    rows.push({ key: `club:${id}`, club: clubsById[id] || null, applications: values });
    values.forEach(application => rows.push({ key: application.id, application, applications: [application], indented: true }));
  });
  const searchText = (row: ParticipationRow) => row.applications.map(application => {
    const profile = profileFor(application);
    const club = application.clubId ? clubsById[String(application.clubId)] : undefined;
    return [profile && buildProfileLabel(profile), club?.name].filter(Boolean).join(' ');
  }).join(' ');
  const renderParticipation = (visible: ParticipationRow[]) => <ThumbnailList
    items={visible} getKey={row => row.key} className="event-participation-list"
    renderItem={row => {
      if (!row.application) return row.club ? <>
        <ThumbnailEntry className="club-thumbnail-link" to={`/clubs/${row.club.alias || row.club.id}`} label={row.club.name}
          image={{ resourceType: 'club', resourceId: row.club.id, url: row.club.photoUrl, thumbnailUrl: row.club.photoThumbnailUrl }} />
        {renderClubActions?.(row.club, row.applications)}
      </> : <span>Club unavailable</span>;
      const profile = profileFor(row.application);
      return <>
        <div className={['profile-list-entry', row.indented ? 'event-club-participant-profiles' : ''].filter(Boolean).join(' ')}>
          {profile ? <ProfileThumbnailLink profile={profile} /> : <span>Profile unavailable</span>}
        </div>
        {profile && renderActions?.(row.application, profile)}
      </>;
    }}
  />;

  return <ProfileRelationshipPanel
    title={title}
    items={rows}
    loaded={!loading || applications.length > 0}
    filterPlaceholder={filterPlaceholder}
    getSearchText={searchText}
    renderItems={renderParticipation}
    emptyText={emptyText}
    noMatchesText={noMatchesText}
    error={error}
    onRetry={onRetry}
    className="event-participation-panel"
    contentRegionLabel={title}
  />;
}
