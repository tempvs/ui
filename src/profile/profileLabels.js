export function buildProfileLabel(profile) {
  return `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim();
}

export function buildClubProfileLabel(profile, getPeriodLabel, fallback = 'Club profile') {
  const baseLabel = buildProfileLabel(profile) || fallback;
  return profile?.period ? `${baseLabel} (${getPeriodLabel(profile.period)})` : baseLabel;
}
