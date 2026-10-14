import React from "react";

import { buildProfileLabel } from "../currentProfile";
import { MessageFormatter, Profile } from "../profileTypes";
import ProfileList from "./ProfileList";
import ProfileRelationshipPanel from "./ProfileRelationshipPanel";

type ProfileFollowingPanelProps = {
  profiles: Profile[];
  loaded: boolean;
  t: MessageFormatter;
  hideWhenEmpty?: boolean;
};

export default function ProfileFollowingPanel({
  profiles,
  loaded,
  t,
  hideWhenEmpty = false,
}: ProfileFollowingPanelProps) {
  return (
    <ProfileRelationshipPanel
      title={t("profile.following.profiles", "Profiles")}
      items={profiles}
      loaded={loaded}
      filterPlaceholder={t("profile.following.filter", "Filter profiles")}
      getSearchText={(profile) =>
        [
          buildProfileLabel(profile),
          profile.firstName,
          profile.lastName,
          profile.nickName,
          profile.alias,
        ]
          .filter(Boolean)
          .join(" ")
      }
      renderItems={(visibleProfiles) => (
        <ProfileList
          profiles={visibleProfiles}
          className="club-member-list profile-club-list mb-0"
        />
      )}
      emptyText={t("profile.following.empty", "No followed profiles yet.")}
      noMatchesText={t(
        "profile.following.noMatches",
        "No followed profiles match this filter.",
      )}
      hideWhenEmpty={hideWhenEmpty}
    />
  );
}
