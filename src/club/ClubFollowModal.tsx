import React from 'react';
import { Alert, Button, Modal } from 'react-bootstrap';
import { useIntl } from 'react-intl';

import { buildProfileLabel } from '../profile/currentProfile';
import { Profile } from '../profile/profileTypes';
import { PeriodBadge } from '../util/periods';

type ClubFollowModalProps = {
  show: boolean;
  profiles: Profile[];
  followingProfileIds: Set<string>;
  busy: boolean;
  error: string;
  onHide: () => void;
  onToggle: (profile: Profile) => void;
};

export default function ClubFollowModal({
  show, profiles, followingProfileIds, busy, error, onHide, onToggle,
}: ClubFollowModalProps) {
  const intl = useIntl();
  const t = (key: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${key}`, defaultMessage });
  return <Modal show={show} onHide={() => { if (!busy) onHide(); }} centered>
    <Modal.Header closeButton={!busy}><Modal.Title>{t('followClub', 'Follow club')}</Modal.Title></Modal.Header>
    <Modal.Body>
      {error && <Alert variant="danger">{error}</Alert>}
      <p className="text-muted">{t('followAsProfile', 'Choose which of your profiles follows this club.')}</p>
      {profiles.length === 0 ? <p>{t('noProfilesToFollow', 'Create a profile before following this club.')}</p> : <ul className="club-member-list mb-0">
        {profiles.map(profile => {
          const following = followingProfileIds.has(String(profile.id));
          return <li key={profile.id}>
            <span>{buildProfileLabel(profile)} <PeriodBadge period={profile.period} /></span>
            <Button size="sm" variant={following ? 'danger' : 'dark'} disabled={busy} onClick={() => onToggle(profile)}>
              {following ? t('unfollow', 'Unfollow') : t('follow', 'Follow')}
            </Button>
          </li>;
        })}
      </ul>}
    </Modal.Body>
    <Modal.Footer><Button variant="outline-secondary" disabled={busy} onClick={onHide}>{t('close', 'Close')}</Button></Modal.Footer>
  </Modal>;
}
