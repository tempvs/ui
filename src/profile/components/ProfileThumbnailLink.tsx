import React from "react";
import { ThumbnailEntry } from "../../component/ThumbnailList";
import { buildProfileLabel } from "../currentProfile";
import { Profile } from "../profileTypes";

export type ProfileThumbnailLinkTarget = Pick<
  Profile,
  "id" | "alias" | "firstName" | "lastName" | "nickName" | "avatarUrl"
> & {
  name?: string | null;
};

type ProfileThumbnailLinkProps = {
  profile: ProfileThumbnailLinkTarget;
  className?: string;
  /** Member cards already render the label beside the avatar. */
  displayLabel?: boolean;
};

/** A consistent profile destination with a refreshed avatar thumbnail. */
export default function ProfileThumbnailLink({
  profile,
  className,
  displayLabel = true,
}: ProfileThumbnailLinkProps) {
  const label =
    profile.name?.trim() || buildProfileLabel(profile, `Profile ${profile.id}`);
  const classes = ["profile-thumbnail-link", className]
    .filter(Boolean)
    .join(" ");

  return (
    <ThumbnailEntry to={`/profile/${profile.alias || profile.id}`} className={classes}
      label={label} displayLabel={displayLabel}
        image={{
          resourceType: "profile",
          resourceId: profile.id,
          thumbnailUrl: profile.avatarUrl,
        }}
        imageClassName="profile-thumbnail-link-image"
    />
  );
}
