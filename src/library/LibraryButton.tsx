import React from 'react';
import { FaBook } from 'react-icons/fa';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import HeaderIconPopover from '../component/HeaderIconPopover';

const BookIcon = FaBook as React.ComponentType;

type LibraryButtonProps = { to?: string };

export default function LibraryButton({ to }: LibraryButtonProps) {
  return (
    <HeaderIconPopover text="library.popover" defaultMessage="Library">
      {to ? <Link to={to} className="header-icon-button" aria-label="Library"><BookIcon /></Link> : (
        <Button className="header-icon-button" variant="default"><BookIcon /></Button>
      )}
    </HeaderIconPopover>
  );
}
