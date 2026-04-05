import React from 'react';
import { OverlayTrigger } from 'react-bootstrap';

import HoverPopover from './HoverPopover';
import IconActionButton from './IconActionButton';

export default function ImageOverlayActionButton({
  popover,
  className = '',
  children,
  ...props
}) {
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
