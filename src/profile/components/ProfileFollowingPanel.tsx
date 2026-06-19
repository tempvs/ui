import React from 'react';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { Avatar, MessageFormatter, Profile } from '../profileTypes';

type ProfileFollowingPanelProps = {
  profiles: Profile[];
  avatars: Record<string, Avatar | null>;
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
  avatars,
  loaded,
  canFollow,
  isFollowing,
  followActionBusy = false,
  t,
  onToggleFollow,
}: ProfileFollowingPanelProps) {
  return (
    <div className="profile-following-panel">
      {canFollow && (
        <Button
          type="button"
          className="w-100 mb-3"
          variant={isFollowing ? 'outline-secondary' : 'outline-dark'}
          onClick={onToggleFollow}
          disabled={followActionBusy}
        >
          {isFollowing
            ? t('profile.unfollow.action', 'Unfollow')
            : t('profile.follow.action', 'Follow')}
        </Button>
      )}

      <div className="profile-following-heading">
        {t('profile.following.heading', 'Following')}
      </div>
      {!loaded && <div className="profile-following-empty">{t('profile.following.loading', 'Loading...')}</div>}
      {loaded && profiles.length === 0 && (
        <div className="profile-following-empty">
          {t('profile.following.empty', 'No followed profiles yet.')}
        </div>
      )}
      {loaded && profiles.length > 0 && (
        <div className="profile-following-list">
          {profiles.map(profile => {
            const avatar = avatars[String(profile.id)] || null;
            return (
              <Link key={String(profile.id)} to={getProfileLink(profile)} className="profile-following-item">
                {avatar?.url && (
                  <span className="profile-following-thumb">
                    <img src={avatar.url} alt={buildProfileLabel(profile)} className="profile-following-thumb-image" />
                  </span>
                )}
                <span className="profile-following-name">{buildProfileLabel(profile)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
