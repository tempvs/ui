import React from 'react';

import SectionBreadcrumb from '../../component/SectionBreadcrumb';
import { buildClubProfileLabel } from '../profileLabels';

function buildProfilePath(getCanonicalProfilePath, profile) {
  return getCanonicalProfilePath(profile);
}

export default function ProfileHeaderBreadcrumb({
  ownerLink,
  ownerLabel,
  currentProfile,
  siblingClubProfiles,
  getCanonicalProfilePath,
  getPeriodLabel,
  emptyLabel,
}) {
  if (!ownerLink) {
    return null;
  }

  const currentLabel = buildClubProfileLabel(currentProfile, getPeriodLabel);

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
          label: buildClubProfileLabel(clubProfile, getPeriodLabel),
          to: buildProfilePath(getCanonicalProfilePath, clubProfile),
        })),
      }}
    />
  );
}
