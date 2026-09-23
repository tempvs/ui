import React from 'react';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { MessageFormatter, Profile } from '../profileTypes';
import RefreshingImage from '../../image/RefreshingImage';
import defaultImage from '../../assets/default-image.png';

type ProfileFollowingPanelProps = {
  profiles: Profile[];
  loaded: boolean;
  canFollow: boolean;
  isFollowing: boolean;
  followActionBusy?: boolean;
  t: MessageFormatter;
  onToggleFollow: () => void;
};

function buildProfileLabel(profile: Profile) {
  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
  return fullName || profile.alias || `Profile ${profile.id}`;
}

function getProfileLink(profile: Profile) {
  return `/profile/${profile.alias || profile.id}`;
}

export default function ProfileFollowingPanel({
  profiles,
  loaded,
  canFollow,
  isFollowing,
  followActionBusy = false,
  t,
  onToggleFollow,
}: ProfileFollowingPanelProps) {
  return (
    <>
      {canFollow && (
        <Button
          type="button"
          className="w-100 mb-3"
          variant={isFollowing ? 'danger' : 'outline-dark'}
          onClick={onToggleFollow}
          disabled={followActionBusy}
        >
          {isFollowing
            ? t('profile.unfollow.action', 'Unfollow')
            : t('profile.follow.action', 'Follow')}
        </Button>
      )}

      <section className="club-panel profile-clubs-panel" aria-label={t('profile.following.heading', 'Followed profiles')}>
        <div className="profile-clubs-heading"><h2 className="mb-0">{t('profile.following.heading', 'Followed profiles')}</h2></div>
        {!loaded && <p className="text-muted mt-3 mb-0">{t('profile.following.loading', 'Loading...')}</p>}
        {loaded && profiles.length === 0 && (
          <p className="text-muted mt-3 mb-0">
          {t('profile.following.empty', 'No followed profiles yet.')}
          </p>
        )}
        {loaded && profiles.length > 0 && (
          <ul className="club-member-list profile-club-list mb-0">
          {profiles.map(profile => {
            return (
              <li key={String(profile.id)}>
                <Link to={getProfileLink(profile)} className="club-thumbnail-link">
                  <RefreshingImage
                    image={{ resourceType: 'profile', resourceId: profile.id, thumbnailUrl: profile.avatarUrl }}
                    variant="thumbnail"
                    fallbackSrc={defaultImage}
                    alt=""
                    className="club-list-thumbnail"
                    loading="lazy"
                  />
                  <span>{buildProfileLabel(profile)}</span>
                </Link>
              </li>
            );
          })}
          </ul>
        )}
      </section>
    </>
  );
}
