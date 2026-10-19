import { useEffect, useState } from "react";

import { Id, Profile } from './profileTypes';

const STORAGE_KEY = 'TEMPVS_CURRENT_PROFILE';
const PROFILE_CHANGE_EVENT = "tempvs:current-profile-change";

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

  const previous = getStoredCurrentProfileValue();
  window.localStorage.setItem(STORAGE_KEY, value);
  // `storage` does not fire in the same browser tab. This local event lets
  // only profile-aware controls refresh while the current route stays put.
  if (previous !== value) {
    window.dispatchEvent(
      new CustomEvent<string>(PROFILE_CHANGE_EVENT, { detail: value }),
    );
  }
}

export function clearStoredCurrentProfileValue() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent<string>(PROFILE_CHANGE_EVENT, {
      detail: DEFAULT_CURRENT_PROFILE_VALUE,
    }),
  );
}

/** Subscribe a mounted component to active-profile changes without routing. */
export function useCurrentProfileValue(): string {
  const [value, setValue] = useState(getStoredCurrentProfileValue);

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      setValue(next || getStoredCurrentProfileValue());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setValue(getStoredCurrentProfileValue());
    };
    window.addEventListener(PROFILE_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PROFILE_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return value;
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
  const selected = options.find(option => option.value === storedValue);
  if (selected) return selected;
  setStoredCurrentProfileValue(DEFAULT_CURRENT_PROFILE_VALUE);
  return options[0] || null;
}

export function resolveCurrentOwnedProfileId(profiles: Profile[]) {
  const storedValue = getStoredCurrentProfileValue();
  if (storedValue === DEFAULT_CURRENT_PROFILE_VALUE) {
    const userProfile = profiles.find(profile => profile.type === 'USER');
    return userProfile?.id != null ? String(userProfile.id) : null;
  }

  const matchedProfile = profiles.find(profile => toProfileValue(profile.id) === storedValue);
  if (matchedProfile?.id != null) return String(matchedProfile.id);
  setStoredCurrentProfileValue(DEFAULT_CURRENT_PROFILE_VALUE);
  const userProfile = profiles.find(profile => profile.type === 'USER');
  return userProfile?.id != null ? String(userProfile.id) : null;
}
