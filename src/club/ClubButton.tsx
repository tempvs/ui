import React from 'react';
import { FaUsers } from 'react-icons/fa';
import { Button } from 'react-bootstrap';
import HeaderIconPopover from '../component/HeaderIconPopover';

const UsersIcon = FaUsers as React.ComponentType;
export default function ClubButton() {
  return <HeaderIconPopover text="clubs.title" defaultMessage="Clubs">
    <Button className="header-icon-button" variant="default"><UsersIcon /></Button>
  </HeaderIconPopover>;
}
