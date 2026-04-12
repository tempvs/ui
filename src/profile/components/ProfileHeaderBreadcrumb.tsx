import React from 'react';

import SectionBreadcrumb from '../../component/SectionBreadcrumb';
import { buildClubProfileLabel, PeriodLabelResolver, ProfileLabelSource } from '../profileLabels';

type ProfilePathBuilder = (profile: ProfileLabelSource) => string;

type ClubProfile = NonNullable<ProfileLabelSource> & {
  id?: string | number;
  alias?: string | null;
};

type ProfileHeaderBreadcrumbProps = {
  ownerLink?: string | null;
  ownerLabel?: React.ReactNode;
  currentProfile: ClubProfile;
  siblingClubProfiles?: ClubProfile[];
  getCanonicalProfilePath: ProfilePathBuilder;
  getPeriodLabel: PeriodLabelResolver;
  emptyLabel?: React.ReactNode;
};

function buildProfilePath(getCanonicalProfilePath: ProfilePathBuilder, profile: ProfileLabelSource): string {
  return getCanonicalProfilePath(profile);
}

export default function ProfileHeaderBreadcrumb({
  ownerLink,
  ownerLabel,
  currentProfile,
  siblingClubProfiles = [],
  getCanonicalProfilePath,
  getPeriodLabel,
  emptyLabel,
}: ProfileHeaderBreadcrumbProps) {
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
