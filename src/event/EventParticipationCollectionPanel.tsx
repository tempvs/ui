import React from 'react';

import ClubThumbnailList from '../club/ClubThumbnailList';
import { Club } from '../club/clubApi';
import { buildProfileLabel } from '../profile/currentProfile';
import ProfileList from '../profile/components/ProfileList';
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

type ClubGroup = { clubId: string; club: Club | null; applications: EventApplication[] };

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
  const searchText = (application: EventApplication) => {
    const profile = profileFor(application);
    const club = application.clubId ? clubsById[String(application.clubId)] : undefined;
    return [profile && buildProfileLabel(profile), club?.name].filter(Boolean).join(' ');
  };
  const renderApplicationList = (values: EventApplication[]) => {
    const profiles = values.map(profileFor).filter((profile): profile is Profile => Boolean(profile));
    return <ProfileList
      profiles={profiles}
      className="club-member-list"
      renderActions={profile => {
        const application = values.find(value => String(value.profileId) === String(profile.id));
        return application ? renderActions?.(application, profile) : null;
      }}
    />;
  };
  const renderParticipation = (visible: EventApplication[]) => {
    const individual = visible.filter(application => !application.clubId);
    const grouped = new Map<string, EventApplication[]>();
    visible.filter(application => application.clubId).forEach(application => {
      const clubId = String(application.clubId);
      grouped.set(clubId, [...(grouped.get(clubId) || []), application]);
    });
    const clubGroups = Array.from(grouped, ([clubId, groupApplications]): ClubGroup => ({
      clubId,
      club: clubsById[clubId] || null,
      applications: groupApplications,
    }));

    return <div className="club-scroll-list event-participation-list" role="region" aria-label={title}>
      {individual.length > 0 && renderApplicationList(individual)}
      {clubGroups.map(group => <div className="event-club-participation" key={group.clubId}>
        {group.club
          ? <ClubThumbnailList clubs={[group.club]} renderActions={club => renderClubActions?.(club, group.applications)} />
          : <div className="event-club-unavailable">Club unavailable</div>}
        <div className="event-club-participant-profiles">{renderApplicationList(group.applications)}</div>
      </div>)}
      {loading && <p role="status" className="text-muted mb-2">Loading…</p>}
    </div>;
  };

  return <ProfileRelationshipPanel
    title={title}
    items={applications}
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
