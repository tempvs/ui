import React, { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { FaBell } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import HeaderIconPopover from '../component/HeaderIconPopover';
import { getUnreadNotificationCount } from './notificationApi';

const BellIcon = FaBell as React.ComponentType<{ 'aria-hidden'?: string }>;

type NotificationButtonProps = { to?: string };

export default function NotificationButton({ to }: NotificationButtonProps) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () => getUnreadNotificationCount()
      .then(value => { if (active) setCount(value.count); })
      .catch(() => undefined);
    load();
    const interval = window.setInterval(load, 30_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  return <HeaderIconPopover text="notifications.popover" defaultMessage="Notifications">
    {to ? <Link to={to} className="header-icon-button notification-nav-button" aria-label={`Notifications${count ? `, ${count} unread` : ''}`}><BellIcon aria-hidden="true" />{count > 0 && <span className="notification-unread-badge">{count > 99 ? '99+' : count}</span>}</Link> : (
      <Button variant="link" className="header-icon-button notification-nav-button" aria-label={`Notifications${count ? `, ${count} unread` : ''}`}><BellIcon aria-hidden="true" />{count > 0 && <span className="notification-unread-badge">{count > 99 ? '99+' : count}</span>}</Button>
    )}
  </HeaderIconPopover>;
}
