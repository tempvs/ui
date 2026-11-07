import React from 'react';
import ThumbnailList, { ThumbnailEntry } from '../component/ThumbnailList';
import { TempvsEvent } from './eventApi';

export default function EventTileList({ events, renderActions }: { events: TempvsEvent[]; renderActions?: (event: TempvsEvent) => React.ReactNode }) {
  return <ThumbnailList items={events} getKey={event => event.id} className="event-thumbnail-list" renderItem={event => <>
      <ThumbnailEntry to={`/events/${event.id}`} label={event.name} image={{ ...event.image, resourceType: 'event', resourceId: event.id }} />
      {renderActions?.(event)}
    </>} />;
}
