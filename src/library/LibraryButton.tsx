import React from 'react';
import { FaBook } from 'react-icons/fa';
import { Button } from 'react-bootstrap';

import HeaderIconPopover from '../component/HeaderIconPopover';

const BookIcon = FaBook as React.ComponentType;

export default function LibraryButton() {
  return (
    <HeaderIconPopover text="library.popover" defaultMessage="Library">
      <Button className="header-icon-button" variant="default">
        <BookIcon />
      </Button>
    </HeaderIconPopover>
  );
}
