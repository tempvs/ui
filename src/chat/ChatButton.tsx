import React from 'react';
import { Button } from 'react-bootstrap';
import { FaComments } from 'react-icons/fa';

import HeaderIconPopover from '../component/HeaderIconPopover';

type IconProps = {
  className?: string;
};

const CommentsIcon = FaComments as React.ComponentType<IconProps>;

export default function ChatButton() {
  return (
    <HeaderIconPopover text="chat.popover" defaultMessage="Chat">
      <Button variant="link" className="header-icon-button" aria-label="Chat">
        <CommentsIcon />
      </Button>
    </HeaderIconPopover>
  );
}
