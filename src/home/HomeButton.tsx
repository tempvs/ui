import React from 'react';
import { FaHome } from 'react-icons/fa';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import HeaderIconPopover from '../component/HeaderIconPopover';

type IconProps = {
  className?: string;
};

const HomeIcon = FaHome as React.ComponentType<IconProps>;

type HomeButtonProps = { to?: string; attention?: boolean };

export default function HomeButton({ to, attention = false }: HomeButtonProps) {
  const className = `header-icon-button${attention ? " onboarding-attention-target" : ""}`;
  return (
    <HeaderIconPopover text="home.popover" defaultMessage="Home">
      {to ? <Link to={to} className={className} aria-label="Home"><HomeIcon /></Link> : (
        <Button className={className} variant="default" aria-label="Home"><HomeIcon /></Button>
      )}
    </HeaderIconPopover>
  );
}
