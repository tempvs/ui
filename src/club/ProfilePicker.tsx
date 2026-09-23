import React from 'react';
import ProfileSearchPicker from '../profile/components/ProfileSearchPicker';
import { Profile } from '../profile/profileTypes';

export default function ProfilePicker({ type, period, busy, onSelect }: {
  type: 'USER' | 'CLUB';
  period?: string | null;
  busy: boolean;
  onSelect: (profile: Profile) => void;
}) {
  return <ProfileSearchPicker type={type} period={period} busy={busy} onSelect={onSelect} selectLabel="Assign" />;
}
