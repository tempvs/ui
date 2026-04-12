export type ProfileLabelSource = {
  firstName?: string | null;
  lastName?: string | null;
  period?: string | null;
} | null | undefined;

export type PeriodLabelResolver = (period: string) => string;

export function buildProfileLabel(profile: ProfileLabelSource): string {
  return `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim();
}

export function buildClubProfileLabel(
  profile: ProfileLabelSource,
  getPeriodLabel: PeriodLabelResolver,
  fallback = 'Club profile'
): string {
  const baseLabel = buildProfileLabel(profile) || fallback;
  return profile?.period ? `${baseLabel} (${getPeriodLabel(profile.period)})` : baseLabel;
}
