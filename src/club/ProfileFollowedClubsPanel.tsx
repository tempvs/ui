import React, { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

import { Id } from '../profile/profileTypes';
import ProfileRelationshipPanel from '../profile/components/ProfileRelationshipPanel';
import { Club, getFollowedClubs, isClubServiceUnavailable } from './clubApi';
import ClubThumbnailList from './ClubThumbnailList';

export default function ProfileFollowedClubsPanel({ profileId, hideWhenEmpty = false }: { profileId: Id; hideWhenEmpty?: boolean }) {
  const intl = useIntl();
  const t = (key: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${key}`, defaultMessage });
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError('');
    setUnavailable(false);
    getFollowedClubs(profileId)
      .then(data => { if (active) setClubs(data); })
      .catch(caught => {
        if (!active) return;
        if (isClubServiceUnavailable(caught)) setUnavailable(true);
        else setError((caught as Error).message);
      })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [profileId, revision]);

  return <ProfileRelationshipPanel
    title={t('title', 'Clubs')}
    items={clubs}
    loaded={loaded}
    filterPlaceholder={t('filterFollowedClubs', 'Filter followed clubs')}
    getSearchText={club => `${club.name} ${club.alias || ''}`}
    renderItems={visibleClubs => <ClubThumbnailList clubs={visibleClubs} />}
    emptyText={t('noFollowedClubs', 'No followed clubs yet.')}
    noMatchesText={t('noMatchingFollowedClubs', 'No followed clubs match this filter.')}
    error={error}
    onRetry={() => setRevision(value => value + 1)}
    className={unavailable ? 'club-service-unavailable' : undefined}
    hideWhenEmpty={hideWhenEmpty}
  />;
}
