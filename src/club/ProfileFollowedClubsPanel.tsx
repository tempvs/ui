import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useIntl } from 'react-intl';

import { DEFAULT_HOURGLASS_IMAGE_SRC } from '../component/DefaultHourglassImage';
import RefreshingImage from '../image/RefreshingImage';
import TextFilterInput from '../component/TextFilterInput';
import { Id } from '../profile/profileTypes';
import { Club, getFollowedClubs, isClubServiceUnavailable } from './clubApi';

export default function ProfileFollowedClubsPanel({ profileId }: { profileId: Id }) {
  const intl = useIntl();
  const t = (key: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${key}`, defaultMessage });
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState('');

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

  const visibleClubs = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    if (!query) return clubs;
    return clubs.filter(club => `${club.name} ${club.alias || ''}`.toLocaleLowerCase().includes(query));
  }, [clubs, filter]);

  if (!loaded || (!error && clubs.length === 0)) return null;
  return <section className={`club-panel profile-clubs-panel mt-3${unavailable ? ' club-service-unavailable' : ''}`} aria-label={t('followedClubs', 'Followed clubs')}>
    <div className="profile-clubs-heading">
      <h2 className="mb-0">{t('followedClubs', 'Followed clubs')}</h2>
      <TextFilterInput
        value={filter}
        onChange={setFilter}
        placeholder={t('filterFollowedClubs', 'Filter clubs')}
        ariaLabel={t('filterFollowedClubs', 'Filter followed clubs')}
        className="club-list-filter"
      />
    </div>
    {error && <Alert variant="danger" className="mt-3">{error} <Button variant="link" onClick={() => setRevision(value => value + 1)}>{t('retry', 'Retry')}</Button></Alert>}
    {clubs.length > 0 && visibleClubs.length === 0 && <p className="text-muted mt-3 mb-0">{t('noMatchingFollowedClubs', 'No followed clubs match this filter.')}</p>}
    {visibleClubs.length > 0 && <ul className="club-member-list profile-club-list mb-0">{visibleClubs.map(club => <li key={club.id}>
      <Link className="club-thumbnail-link" to={`/clubs/${club.alias || club.id}`}>
        <RefreshingImage
          image={{ id: club.photoImageId, resourceType: 'club', resourceId: club.id, url: club.photoUrl, thumbnailUrl: club.photoThumbnailUrl }}
          variant="thumbnail"
          fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC}
          className="club-list-thumbnail"
          alt=""
          loading="lazy"
        />
        <span>{club.name}</span>
      </Link>
    </li>)}</ul>}
  </section>;
}
