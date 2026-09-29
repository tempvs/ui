import React from "react";
import { Link } from "react-router-dom";

import { DEFAULT_HOURGLASS_IMAGE_SRC } from "../../component/DefaultHourglassImage";
import RefreshingImage from "../../image/RefreshingImage";
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
};

/** A consistent profile destination with a refreshed avatar thumbnail. */
export default function ProfileThumbnailLink({
  profile,
  className,
}: ProfileThumbnailLinkProps) {
  const label =
    profile.name?.trim() || buildProfileLabel(profile, `Profile ${profile.id}`);
  const classes = ["profile-thumbnail-link", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to={`/profile/${profile.alias || profile.id}`} className={classes}>
      <RefreshingImage
        image={{
          resourceType: "profile",
          resourceId: profile.id,
          thumbnailUrl: profile.avatarUrl,
        }}
        variant="thumbnail"
        fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC}
        className="profile-thumbnail-link-image"
        alt=""
        loading="lazy"
      />
      <span>{label}</span>
    </Link>
  );
}
