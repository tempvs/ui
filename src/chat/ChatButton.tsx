import React, { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { FaComments } from "react-icons/fa";
import { Link } from "react-router-dom";

import HeaderIconPopover from "../component/HeaderIconPopover";
import { getUnreadCount } from "./chatApi";

type IconProps = {
  className?: string;
};

const CommentsIcon = FaComments as React.ComponentType<IconProps>;

type ChatButtonProps = { to?: string; profileId?: string };

export default function ChatButton({ to, profileId }: ChatButtonProps) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    setUnread(0);
    if (!profileId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let inFlight = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (!active || document.visibilityState === "hidden" || inFlight) return;
      inFlight = true;
      try {
        const count = await getUnreadCount(profileId, controller.signal);
        if (active) setUnread(count);
      } catch {
        /* Retain the last known count through transient failures. */
      } finally {
        inFlight = false;
      }
    };
    const tick = async () => {
      await refresh();
      if (active) timer = setTimeout(tick, 15000);
    };
    void tick();
    const changed = () => {
      void refresh();
    };
    window.addEventListener("tempvs:chat-unread-changed", changed);
    window.addEventListener("focus", changed);
    document.addEventListener("visibilitychange", changed);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener("tempvs:chat-unread-changed", changed);
      window.removeEventListener("focus", changed);
      document.removeEventListener("visibilitychange", changed);
    };
  }, [profileId]);
  const icon = (
    <>
      <CommentsIcon />
      {unread > 0 && (
        <span
          className="chat-unread-badge"
          aria-label={`${unread} unread messages`}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </>
  );
  return (
    <HeaderIconPopover text="chat.popover" defaultMessage="Chat">
      {to ? (
        <Link
          to={to}
          className="header-icon-button chat-nav-button"
          aria-label="Chat"
        >
          {icon}
        </Link>
      ) : (
        <Button
          variant="link"
          className="header-icon-button chat-nav-button"
          aria-label="Chat"
        >
          {icon}
        </Button>
      )}
    </HeaderIconPopover>
  );
}
