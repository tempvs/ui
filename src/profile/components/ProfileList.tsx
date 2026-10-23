import React from 'react';

import { Profile } from '../profileTypes';
import { PeriodBadge } from '../../util/periods';
import ProfileThumbnailLink from './ProfileThumbnailLink';

type ProfileListProps = {
  profiles: Profile[];
  className?: string;
  showPeriod?: boolean;
  renderActions?: (profile: Profile) => React.ReactNode;
  renderMeta?: (profile: Profile) => React.ReactNode;
  actionPosition?: 'start' | 'end';
};

/** Shared thumbnail profile list. Missing avatars use the default hourglass via ProfileThumbnailLink. */
export default function ProfileList({
  profiles,
  className,
  showPeriod = false,
  renderActions,
  renderMeta,
  actionPosition = 'end',
}: ProfileListProps) {
  return <ul className={['profile-list', className].filter(Boolean).join(' ')}>
    {profiles.map(profile => <li key={String(profile.id)}>
      {actionPosition === 'start' && renderActions?.(profile)}
      <div className="profile-list-entry">
        <div className="profile-list-profile">
          <ProfileThumbnailLink profile={profile} />
          {renderMeta?.(profile) && <div className="small text-muted">{renderMeta(profile)}</div>}
        </div>
        {showPeriod && <PeriodBadge period={profile.period} />}
      </div>
      {actionPosition === 'end' && renderActions?.(profile)}
    </li>)}
  </ul>;
}
