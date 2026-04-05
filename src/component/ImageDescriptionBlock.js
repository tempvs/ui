import React from 'react';
import { OverlayTrigger } from 'react-bootstrap';

import HoverPopover from './HoverPopover';

export default function ImageDescriptionBlock({
  description,
  emptyText = '',
  bordered = false,
  className = '',
}) {
  const text = (description || '').trim() || emptyText;

  if (!text) {
    return null;
  }

  return (
    <OverlayTrigger
      trigger={['hover', 'focus']}
      placement="bottom"
      overlay={<HoverPopover text="" default={text} style={{ maxWidth: '20rem' }} />}
    >
      <div
        className={`${bordered ? 'p-2 border-top ' : ''}small text-muted text-center ${className}`.trim()}
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'default',
        }}
      >
        {text}
      </div>
    </OverlayTrigger>
  );
}
