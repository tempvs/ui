import React from 'react';
import { FaUser } from 'react-icons/fa';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import HeaderIconPopover from '../component/HeaderIconPopover';

const UserIcon = FaUser as React.ComponentType;

type ProfileButtonProps = { to?: string };

export default function ProfileButton({ to }: ProfileButtonProps) {
  return (
    <HeaderIconPopover text="profile.popover" defaultMessage="Profile">
      {to ? <Link to={to} className="header-icon-button" aria-label="Profile"><UserIcon /></Link> : (
        <Button className="header-icon-button" variant="default"><UserIcon /></Button>
      )}
    </HeaderIconPopover>
  );
}
