import React from 'react';
import { Button } from 'react-bootstrap';
import { FaCalendarAlt } from 'react-icons/fa';
import HeaderIconPopover from '../component/HeaderIconPopover';

const CalendarIcon = FaCalendarAlt as React.ComponentType;

export default function EventButton() {
  return <HeaderIconPopover text="events.title" defaultMessage="Events">
    <Button className="header-icon-button" variant="default" aria-label="Events"><CalendarIcon /></Button>
  </HeaderIconPopover>;
}
