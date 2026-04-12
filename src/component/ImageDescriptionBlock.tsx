import React, { useRef } from 'react';
import { OverlayTrigger } from 'react-bootstrap';

import HoverPopover from './HoverPopover';
import useIsTruncated from './useIsTruncated';

type ImageDescriptionBlockProps = {
  description?: string | null;
  emptyText?: string;
  bordered?: boolean;
  className?: string;
};

export default function ImageDescriptionBlock({
  description,
  emptyText = '',
  bordered = false,
  className = '',
}: ImageDescriptionBlockProps) {
  const text = (description || '').trim() || emptyText;
  const textRef = useRef<HTMLDivElement>(null);
  const isTruncated = useIsTruncated(textRef, [text]);

  if (!text) {
    return null;
  }

  const content = (
    <div
      ref={textRef}
      className={`${bordered ? 'p-2 border-top ' : ''}small text-muted text-center ${className}`.trim()}
      style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: isTruncated ? 'default' : 'text',
      }}
    >
      {text}
    </div>
  );

  if (!isTruncated) {
    return content;
  }

  return (
    <OverlayTrigger
      trigger={['hover', 'focus']}
      placement="bottom"
      overlay={<HoverPopover text="" default={text} style={{ maxWidth: '20rem' }} />}
    >
      {content}
    </OverlayTrigger>
  );
}
