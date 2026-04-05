import React from 'react';

import SectionBreadcrumb from '../../component/SectionBreadcrumb';

function buildProfilePath(getCanonicalProfilePath, profile) {
  return getCanonicalProfilePath(profile);
}

export default function ProfileHeaderBreadcrumb({
  ownerLink,
  ownerLabel,
  currentLabel,
  currentProfile,
  siblingClubProfiles,
  getCanonicalProfilePath,
  emptyLabel,
}) {
  if (!ownerLink) {
    return null;
  }

  return (
    <SectionBreadcrumb
      items={[
        { label: ownerLabel, to: ownerLink },
        { label: currentLabel, to: buildProfilePath(getCanonicalProfilePath, currentProfile) },
      ]}
      switcher={{
        id: 'club-profile-switcher',
        emptyLabel,
        items: siblingClubProfiles.map(clubProfile => ({
          key: clubProfile.id,
          label: `${clubProfile.firstName} ${clubProfile.lastName}`.trim(),
          to: buildProfilePath(getCanonicalProfilePath, clubProfile),
        })),
      }}
    />
  );
}
