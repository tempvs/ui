import React from 'react';

import { Profile } from '../profileTypes';
import { PeriodBadge } from '../../util/periods';
import ProfileThumbnailLink from './ProfileThumbnailLink';

type ProfileListProps = {
  profiles: Profile[];
  className?: string;
  showPeriod?: boolean;
  renderActions?: (profile: Profile) => React.ReactNode;
};

/** Shared thumbnail profile list. Missing avatars use the default hourglass via ProfileThumbnailLink. */
export default function ProfileList({
  profiles,
  className,
  showPeriod = false,
  renderActions,
}: ProfileListProps) {
  return <ul className={['profile-list', className].filter(Boolean).join(' ')}>
    {profiles.map(profile => <li key={String(profile.id)}>
      <div className="profile-list-entry">
        <ProfileThumbnailLink profile={profile} />
        {showPeriod && <PeriodBadge period={profile.period} />}
      </div>
      {renderActions?.(profile)}
    </li>)}
  </ul>;
}
