import React from 'react';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaCalendarAlt } from 'react-icons/fa';
import HeaderIconPopover from '../component/HeaderIconPopover';

const CalendarIcon = FaCalendarAlt as React.ComponentType;
type EventButtonProps = { to?: string };

export default function EventButton({ to }: EventButtonProps) {
  return <HeaderIconPopover text="events.title" defaultMessage="Events">
    {to ? <Link to={to} className="header-icon-button" aria-label="Events"><CalendarIcon /></Link> : (
      <Button className="header-icon-button" variant="default" aria-label="Events"><CalendarIcon /></Button>
    )}
  </HeaderIconPopover>;
}
