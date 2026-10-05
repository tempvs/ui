import React from 'react';
import { FaHome } from 'react-icons/fa';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import HeaderIconPopover from '../component/HeaderIconPopover';

type IconProps = {
  className?: string;
};

const HomeIcon = FaHome as React.ComponentType<IconProps>;

type HomeButtonProps = { to?: string };

export default function HomeButton({ to }: HomeButtonProps) {
  return (
    <HeaderIconPopover text="home.popover" defaultMessage="Home">
      {to ? <Link to={to} className="header-icon-button" aria-label="Home"><HomeIcon /></Link> : (
        <Button className="header-icon-button" variant="default" aria-label="Home"><HomeIcon /></Button>
      )}
    </HeaderIconPopover>
  );
}
