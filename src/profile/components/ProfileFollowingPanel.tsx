import React, { useMemo, useState } from "react";
import { Button } from "react-bootstrap";

import TextFilterInput from "../../component/TextFilterInput";
import { buildProfileLabel } from "../currentProfile";
import { MessageFormatter, Profile } from "../profileTypes";
import ProfileList from "./ProfileList";

type ProfileFollowingPanelProps = {
  profiles: Profile[];
  loaded: boolean;
  canFollow: boolean;
  isFollowing: boolean;
  followActionBusy?: boolean;
  t: MessageFormatter;
  onToggleFollow: () => void;
};

export default function ProfileFollowingPanel({
  profiles,
  loaded,
  canFollow,
  isFollowing,
  followActionBusy = false,
  t,
  onToggleFollow,
}: ProfileFollowingPanelProps) {
  const [filter, setFilter] = useState("");
  const visibleProfiles = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    if (!query) return profiles;
    return profiles.filter(profile => [
      buildProfileLabel(profile),
      profile.firstName,
      profile.lastName,
      profile.nickName,
      profile.alias,
    ].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
  }, [filter, profiles]);

  return (
    <>
      {canFollow && (
        <Button
          type="button"
          className="w-100 mb-3"
          variant={isFollowing ? "danger" : "outline-dark"}
          onClick={onToggleFollow}
          disabled={followActionBusy}
        >
          {isFollowing
            ? t("profile.unfollow.action", "Unfollow")
            : t("profile.follow.action", "Follow")}
        </Button>
      )}

      <section
        className="club-panel profile-clubs-panel"
        aria-label={t("profile.following.heading", "Followed profiles")}
      >
        <div className="profile-clubs-heading">
          <h2 className="mb-0">
            {t("profile.following.heading", "Followed profiles")}
          </h2>
          <TextFilterInput
            value={filter}
            onChange={setFilter}
            placeholder={t("profile.following.filter", "Filter profiles")}
            ariaLabel={t("profile.following.filter", "Filter profiles")}
            className="club-list-filter"
          />
        </div>
        {!loaded && (
          <p className="text-muted mt-3 mb-0">
            {t("profile.following.loading", "Loading...")}
          </p>
        )}
        {loaded && profiles.length === 0 && (
          <p className="text-muted mt-3 mb-0">
            {t("profile.following.empty", "No followed profiles yet.")}
          </p>
        )}
        {loaded && profiles.length > 0 && visibleProfiles.length === 0 && (
          <p className="text-muted mt-3 mb-0">
            {t("profile.following.noMatches", "No followed profiles match this filter.")}
          </p>
        )}
        {loaded && visibleProfiles.length > 0 && <ProfileList profiles={visibleProfiles} className="club-member-list profile-club-list mb-0" />}
      </section>
    </>
  );
}
