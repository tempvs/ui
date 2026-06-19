import { Id, Profile } from './profileTypes';

const STORAGE_KEY = 'TEMPVS_CURRENT_PROFILE';

export const DEFAULT_CURRENT_PROFILE_VALUE = 'user-profile';

export type CurrentProfileOption = {
  value: string;
  label: string;
  path: string;
  profile: Profile | null;
};

function toProfileValue(profileId: Id) {
  return `profile:${String(profileId)}`;
}

export function getStoredCurrentProfileValue() {
  if (typeof window === 'undefined') {
    return DEFAULT_CURRENT_PROFILE_VALUE;
  }

  return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_CURRENT_PROFILE_VALUE;
}

export function setStoredCurrentProfileValue(value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, value);
}

export function clearStoredCurrentProfileValue() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function buildProfileLabel(profile: Profile | null | undefined, fallback = 'My profile') {
  if (!profile) {
    return fallback;
  }

  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
  return fullName || profile.nickName || profile.alias || fallback;
}

export function buildOwnedProfileOptions(userProfile: Profile | null, clubProfiles: Profile[]): CurrentProfileOption[] {
  const options: CurrentProfileOption[] = [{
    value: DEFAULT_CURRENT_PROFILE_VALUE,
    label: buildProfileLabel(userProfile, 'My profile'),
    path: '/profile',
    profile: userProfile,
  }];

  clubProfiles.forEach(profile => {
    if (profile?.id == null) {
      return;
    }

    options.push({
      value: toProfileValue(profile.id),
      label: buildProfileLabel(profile, 'Club profile'),
      path: `/profile/${profile.id}`,
      profile,
    });
  });

  return options;
}

export function resolveCurrentProfileOption(options: CurrentProfileOption[]) {
  const storedValue = getStoredCurrentProfileValue();
  return options.find(option => option.value === storedValue) || options[0] || null;
}

export function resolveCurrentOwnedProfileId(profiles: Profile[]) {
  const storedValue = getStoredCurrentProfileValue();
  if (storedValue === DEFAULT_CURRENT_PROFILE_VALUE) {
    const userProfile = profiles.find(profile => profile.type === 'USER');
    return userProfile?.id != null ? Number(userProfile.id) : null;
  }

  const matchedProfile = profiles.find(profile => toProfileValue(profile.id) === storedValue);
  return matchedProfile?.id != null ? Number(matchedProfile.id) : null;
}
