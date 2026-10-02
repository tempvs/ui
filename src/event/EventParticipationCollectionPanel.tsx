import React, { useMemo, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';

import ClubThumbnailList from '../club/ClubThumbnailList';
import { Club } from '../club/clubApi';
import TextFilterInput from '../component/TextFilterInput';
import { buildProfileLabel } from '../profile/currentProfile';
import ProfileList from '../profile/components/ProfileList';
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

type ClubGroup = {
  clubId: string;
  club: Club | null;
  applications: EventApplication[];
};

/** Shared hierarchical event participation list: club tile first, then its indented profiles. */
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
  const [filter, setFilter] = useState('');
  const { individual, clubGroups } = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    const matchesProfile = (application: EventApplication) => {
      const profile = application.profileId ? profilesById[String(application.profileId)] : null;
      return Boolean(profile && buildProfileLabel(profile).toLocaleLowerCase().includes(query));
    };
    const individualApplications = applications.filter(application => !application.clubId);
    const grouped = new Map<string, EventApplication[]>();
    applications.filter(application => application.clubId).forEach(application => {
      const clubId = String(application.clubId);
      grouped.set(clubId, [...(grouped.get(clubId) || []), application]);
    });
    const groups = Array.from(grouped, ([clubId, groupApplications]): ClubGroup => ({
      clubId,
      club: clubsById[clubId] || null,
      applications: !query || clubsById[clubId]?.name.toLocaleLowerCase().includes(query)
        ? groupApplications
        : groupApplications.filter(matchesProfile),
    })).filter(group => group.applications.length > 0);
    return {
      individual: query ? individualApplications.filter(matchesProfile) : individualApplications,
      clubGroups: groups,
    };
  }, [applications, clubsById, filter, profilesById]);

  const profileFor = (application: EventApplication) => application.profileId
    ? profilesById[String(application.profileId)]
    : undefined;
  const visibleCount = individual.length + clubGroups.reduce((count, group) => count + group.applications.length, 0);
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

  return <section className="club-panel event-participation-panel">
    <div className="club-list-heading">
      <h2>{title}</h2>
      <TextFilterInput value={filter} onChange={setFilter} placeholder={filterPlaceholder} ariaLabel={filterPlaceholder} className="club-list-filter" />
    </div>
    {error && <Alert variant="danger">{error} {onRetry && <Button variant="link" onClick={onRetry}>Retry</Button>}</Alert>}
    {!loading && !error && applications.length === 0 && <p>{emptyText}</p>}
    {!loading && !error && applications.length > 0 && visibleCount === 0 && <p>{noMatchesText}</p>}
    {visibleCount > 0 && <div className="club-scroll-list event-participation-list" role="region" aria-label={title}>
      {individual.length > 0 && renderApplicationList(individual)}
      {clubGroups.map(group => <div className="event-club-participation" key={group.clubId}>
        {group.club
          ? <ClubThumbnailList clubs={[group.club]} renderActions={club => renderClubActions?.(club, group.applications)} />
          : <div className="event-club-unavailable">Club unavailable</div>}
        <div className="event-club-participant-profiles">{renderApplicationList(group.applications)}</div>
      </div>)}
    </div>}
    {loading && <p role="status" className="text-muted mb-2">Loading…</p>}
  </section>;
}
