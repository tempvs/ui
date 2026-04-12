import React from 'react';
import { FaUser } from 'react-icons/fa';
import { Button } from 'react-bootstrap';

import HeaderIconPopover from '../component/HeaderIconPopover';

const UserIcon = FaUser as React.ComponentType;

export default function ProfileButton() {
  return (
    <HeaderIconPopover text="profile.popover" defaultMessage="Profile">
      <Button className="header-icon-button" variant="default">
        <UserIcon />
      </Button>
    </HeaderIconPopover>
  );
}
