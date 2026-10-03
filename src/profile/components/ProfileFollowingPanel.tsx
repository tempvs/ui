import React from "react";
import { Button } from "react-bootstrap";

import { buildProfileLabel } from "../currentProfile";
import { MessageFormatter, Profile } from "../profileTypes";
import ProfileList from "./ProfileList";
import ProfileRelationshipPanel from "./ProfileRelationshipPanel";

type ProfileFollowingPanelProps = {
  profiles: Profile[];
  loaded: boolean;
  canFollow: boolean;
  isFollowing: boolean;
  followActionBusy?: boolean;
  t: MessageFormatter;
  onToggleFollow: () => void;
  hideWhenEmpty?: boolean;
};

export default function ProfileFollowingPanel({
  profiles,
  loaded,
  canFollow,
  isFollowing,
  followActionBusy = false,
  t,
  onToggleFollow,
  hideWhenEmpty = false,
}: ProfileFollowingPanelProps) {
  return (
    <>
      {canFollow && (
        <Button
          type="button"
          className="w-100 mb-3 profile-follow-action"
          variant={isFollowing ? "danger" : "outline-dark"}
          onClick={onToggleFollow}
          disabled={followActionBusy}
        >
          {isFollowing
            ? t("profile.unfollow.action", "Unfollow")
            : t("profile.follow.action", "Follow")}
        </Button>
      )}

      <ProfileRelationshipPanel
        title={t("profile.following.profiles", "Profiles")}
        items={profiles}
        loaded={loaded}
        filterPlaceholder={t("profile.following.filter", "Filter profiles")}
        getSearchText={profile => [
          buildProfileLabel(profile),
          profile.firstName,
          profile.lastName,
          profile.nickName,
          profile.alias,
        ].filter(Boolean).join(' ')}
        renderItems={visibleProfiles => <ProfileList profiles={visibleProfiles} className="club-member-list profile-club-list mb-0" />}
        emptyText={t("profile.following.empty", "No followed profiles yet.")}
        noMatchesText={t("profile.following.noMatches", "No followed profiles match this filter.")}
        hideWhenEmpty={hideWhenEmpty && !canFollow}
      />
    </>
  );
}
