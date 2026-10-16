import React from "react";
import ProfileSearchPicker from "../profile/components/ProfileSearchPicker";
import { Profile } from "../profile/profileTypes";

export default function ProfilePicker({
  type,
  period,
  busy,
  onSelect,
  ownedProfiles = [],
  selectLabel = "Assign",
  placeholder,
}: {
  type?: "USER" | "CLUB";
  period?: string | null;
  busy: boolean;
  onSelect: (profile: Profile) => void;
  ownedProfiles?: Profile[];
  selectLabel?: string;
  placeholder?: string;
}) {
  return (
    <ProfileSearchPicker
      type={type}
      period={period}
      busy={busy}
      onSelect={onSelect}
      ownedProfiles={ownedProfiles}
      selectLabel={selectLabel}
      placeholder={placeholder}
    />
  );
}
