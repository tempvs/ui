import React from "react";
import { FaUser } from "react-icons/fa";
import { Button } from "react-bootstrap";
import { Link } from "react-router-dom";

import HeaderIconPopover from "../component/HeaderIconPopover";
import DismissibleCoachmark from "../component/DismissibleCoachmark";

const UserIcon = FaUser as React.ComponentType;

type ProfileButtonProps = {
  to?: string;
  showNavigationCoachmark?: boolean;
  navigationCoachmarkId?: string;
};

export default function ProfileButton({
  to,
  showNavigationCoachmark = false,
  navigationCoachmarkId = "open-current-profile",
}: ProfileButtonProps) {
  const button = to ? (
    <Link to={to} className="header-icon-button" aria-label="Profile">
      <UserIcon />
    </Link>
  ) : (
    <Button className="header-icon-button" variant="default">
      <UserIcon />
    </Button>
  );
  return (
    <HeaderIconPopover text="profile.popover" defaultMessage="Profile">
      <DismissibleCoachmark
        id={navigationCoachmarkId}
        visible={showNavigationCoachmark}
        message="Click this icon to navigate to your current profile."
      >
        {button}
      </DismissibleCoachmark>
    </HeaderIconPopover>
  );
}
