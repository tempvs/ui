import React from 'react';
import { FaUsers } from 'react-icons/fa';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import HeaderIconPopover from '../component/HeaderIconPopover';

const UsersIcon = FaUsers as React.ComponentType;
type ClubButtonProps = { to?: string };
export default function ClubButton({ to }: ClubButtonProps) {
  return <HeaderIconPopover text="clubs.title" defaultMessage="Clubs">
    {to ? <Link to={to} className="header-icon-button" aria-label="Clubs"><UsersIcon /></Link> : (
      <Button className="header-icon-button" variant="default"><UsersIcon /></Button>
    )}
  </HeaderIconPopover>;
}
