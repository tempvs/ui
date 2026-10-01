import React from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_HOURGLASS_IMAGE_SRC } from '../component/DefaultHourglassImage';
import RefreshingImage from '../image/RefreshingImage';
import { TempvsEvent } from './eventApi';

export default function EventTileList({ events, renderActions }: { events: TempvsEvent[]; renderActions?: (event: TempvsEvent) => React.ReactNode }) {
  return <ul className="event-tile-list">{events.map(event => <li key={event.id}>
      <Link to={`/events/${event.id}`} className="event-tile-link"><RefreshingImage image={{ resourceType: 'event', resourceId: event.id }} variant="thumbnail" fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC} className="event-tile-thumbnail" alt="" /><span>{event.name}</span></Link>
      {renderActions?.(event)}
    </li>)}</ul>;
}
