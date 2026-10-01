import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_HOURGLASS_IMAGE_SRC } from '../component/DefaultHourglassImage';
import TextFilterInput from '../component/TextFilterInput';
import RefreshingImage from '../image/RefreshingImage';
import { TempvsEvent } from './eventApi';

export default function EventTileList({ events, filterLabel = 'Filter events', renderActions }: { events: TempvsEvent[]; filterLabel?: string; renderActions?: (event: TempvsEvent) => React.ReactNode }) {
  const [filter, setFilter] = useState('');
  const visible = useMemo(() => { const query = filter.trim().toLocaleLowerCase(); return query ? events.filter(event => `${event.name} ${event.description || ''}`.toLocaleLowerCase().includes(query)) : events; }, [events, filter]);
  return <>
    <TextFilterInput value={filter} onChange={setFilter} placeholder={filterLabel} ariaLabel={filterLabel} className="club-list-filter" />
    <ul className="event-tile-list">{visible.map(event => <li key={event.id}>
      <Link to={`/events/${event.id}`} className="event-tile-link"><RefreshingImage image={{ resourceType: 'event', resourceId: event.id }} variant="thumbnail" fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC} className="event-tile-thumbnail" alt="" /><span>{event.name}</span></Link>
      {renderActions?.(event)}
    </li>)}</ul>
    {events.length > 0 && visible.length === 0 && <p className="text-muted mb-0">No events match this filter.</p>}
  </>;
}
