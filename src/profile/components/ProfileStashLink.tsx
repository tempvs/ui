import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import DismissibleCoachmark from "../../component/DismissibleCoachmark";
import { getGroupItems, getProfileStash } from "../stashApi";

type ProfileStashLinkProps = {
  profileId: string | number;
  alias?: string | null;
  editable: boolean;
  label: string;
};

/** Keeps the first-item hint accurate without making the profile page own stash state. */
export default function ProfileStashLink({
  profileId,
  alias,
  editable,
  label,
}: ProfileStashLinkProps) {
  const [hasItems, setHasItems] = useState(true);

  useEffect(() => {
    let active = true;
    if (!editable) return undefined;
    void getProfileStash(profileId)
      .then(async (stash) => {
        const groups = stash?.groups || [];
        const itemGroups = await Promise.all(groups.map((group) => getGroupItems(group.id)));
        if (active) setHasItems(itemGroups.some((items) => items.length > 0));
      })
      .catch(() => {
        // A failed optional hint read must never suggest an incorrect empty stash.
        if (active) setHasItems(true);
      });
    return () => {
      active = false;
    };
  }, [editable, profileId]);

  return (
    <DismissibleCoachmark
      id={`open-owned-items:${profileId}`}
      visible={editable && !hasItems}
      message="Add items you own."
      className="profile-stash-coachmark"
    >
      <Link to={`/stash/${alias || profileId}`} className="btn btn-outline-secondary profile-stash-button">
        {label}
      </Link>
    </DismissibleCoachmark>
  );
}
