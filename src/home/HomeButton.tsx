import React from 'react';
import { FaHome } from 'react-icons/fa';
import { Button } from 'react-bootstrap';

import HeaderIconPopover from '../component/HeaderIconPopover';

type IconProps = {
  className?: string;
};

const HomeIcon = FaHome as React.ComponentType<IconProps>;

export default function HomeButton() {
  return (
    <HeaderIconPopover text="home.popover" defaultMessage="Home">
      <Button className="header-icon-button" variant="default" aria-label="Home">
        <HomeIcon />
      </Button>
    </HeaderIconPopover>
  );
}
