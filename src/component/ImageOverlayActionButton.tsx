import React from 'react';
import { OverlayTrigger } from 'react-bootstrap';

import HoverPopover from './HoverPopover';
import IconActionButton, { IconActionButtonProps } from './IconActionButton';

type ImageOverlayActionButtonProps = IconActionButtonProps & {
  popover: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

export default function ImageOverlayActionButton({
  popover,
  className = '',
  children,
  ...props
}: ImageOverlayActionButtonProps) {
  return (
    <OverlayTrigger
      trigger={['hover', 'focus']}
      placement="bottom"
      overlay={<HoverPopover text="" default={popover} style={{ maxWidth: '16rem' }} />}
    >
      <span className={className}>
        <IconActionButton {...props}>
          {children}
        </IconActionButton>
      </span>
    </OverlayTrigger>
  );
}
