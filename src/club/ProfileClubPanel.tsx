import React, { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Id } from '../profile/profileTypes';
import { Club, getProfileClubs, isClubServiceUnavailable } from './clubApi';
import ProfileRelationshipPanel from '../profile/components/ProfileRelationshipPanel';
import ClubThumbnailList from './ClubThumbnailList';
import './clubs.css';

export default function ProfileClubPanel({ profileId }: { profileId: Id; period?: string; editable: boolean }) {
  const intl = useIntl();
  const t = (key: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${key}`, defaultMessage });
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setLoaded(false); setError(''); setUnavailable(false);
    getProfileClubs(profileId).then(data => { if (active) { setClubs(data); setLoaded(true); } })
      .catch(e => {
        if (active) {
          if (isClubServiceUnavailable(e)) setUnavailable(true);
          else setError(e.message);
          setLoaded(true);
        }
      });
    return () => { active = false; };
  }, [profileId, revision]);
  return <ProfileRelationshipPanel
    title={t('title', 'Clubs')}
    items={clubs}
    loaded={loaded}
    filterPlaceholder={t('filterMemberships', 'Filter club memberships')}
    getSearchText={club => `${club.name} ${club.alias || ''}`}
    renderItems={visibleClubs => <ClubThumbnailList clubs={visibleClubs} />}
    emptyText={t('noMemberships', 'No club memberships yet.')}
    noMatchesText={t('noMatchingMemberships', 'No club memberships match this filter.')}
    error={error}
    onRetry={() => setRevision(value => value + 1)}
    className={unavailable ? 'club-service-unavailable' : undefined}
  />;
}
