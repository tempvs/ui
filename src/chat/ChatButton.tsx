import React from 'react';
import { Button } from 'react-bootstrap';
import { FaComments } from 'react-icons/fa';
import { Link } from 'react-router-dom';

import HeaderIconPopover from '../component/HeaderIconPopover';

type IconProps = {
  className?: string;
};

const CommentsIcon = FaComments as React.ComponentType<IconProps>;

type ChatButtonProps = { to?: string };

export default function ChatButton({ to }: ChatButtonProps) {
  return (
    <HeaderIconPopover text="chat.popover" defaultMessage="Chat">
      {to ? <Link to={to} className="header-icon-button chat-nav-button" aria-label="Chat"><CommentsIcon /></Link> : (
        <Button variant="link" className="header-icon-button chat-nav-button" aria-label="Chat"><CommentsIcon /></Button>
      )}
    </HeaderIconPopover>
  );
}
