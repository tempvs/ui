import React from "react";
import { Button } from "react-bootstrap";

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
        {loaded && profiles.length > 0 && <ProfileList profiles={profiles} className="club-member-list profile-club-list mb-0" />}
      </section>
    </>
  );
}
