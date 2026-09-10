import React, { useEffect, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useIntl } from 'react-intl';
import defaultImage from '../assets/default-image.png';
import { Id } from '../profile/profileTypes';
import { Club, getProfileClubs } from './clubApi';
import JoinClubModal from './JoinClubModal';
import './clubs.css';

export default function ProfileClubPanel({ profileId, period, editable }: { profileId: Id; period?: string; editable: boolean }) {
  const intl = useIntl();
  const t = (key: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${key}`, defaultMessage });
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setLoaded(false); setError('');
    getProfileClubs(profileId).then(data => { if (active) { setClubs(data); setLoaded(true); } })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [profileId, revision]);
  // An unattached profile has no club UI for visitors, including while loading.
  if (!editable && (!loaded || clubs.length === 0)) return null;
  return <section className="club-panel profile-clubs-panel mt-3" aria-label={t('title', 'Clubs')}>
    <div className="profile-clubs-heading">
      <h2 className="mb-0">{t('title', 'Clubs')}</h2>
      {editable && <Button variant="outline-secondary" onClick={() => setJoining(true)}>{t('join', 'Join club')}</Button>}
    </div>
    {error && <Alert variant="danger" className="mt-3">{error} <Button variant="link" onClick={() => setRevision(value => value + 1)}>{t('retry', 'Retry')}</Button></Alert>}
    {loaded && clubs.length > 0 && <ul className="club-member-list profile-club-list mb-0">{clubs.map(club => <li key={club.id}>
      <Link className="club-thumbnail-link" to={`/clubs/${club.id}`}>
        <img className="club-list-thumbnail" src={club.photoUrl || defaultImage} alt="" loading="lazy" />
        <span>{club.name}</span>
      </Link>
    </li>)}</ul>}
    {editable && joining && <JoinClubModal profileId={profileId} period={period} onClose={() => { setJoining(false); setRevision(value => value + 1); }} />}
  </section>;
}
