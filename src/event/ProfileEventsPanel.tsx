import React, { useEffect, useState } from 'react';
import ProfileRelationshipPanel from '../profile/components/ProfileRelationshipPanel';
import EventTileList from './EventTileList';
import { getFollowedEvents, getParticipatingEvents, TempvsEvent } from './eventApi';

export default function ProfileEventsPanel({ profileId, kind }: { profileId: string; kind: 'followed' | 'participating' }) {
  const [events, setEvents] = useState<TempvsEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const requestEvents = () => kind === 'followed' ? getFollowedEvents(profileId) : getParticipatingEvents(profileId);
  const load = () => {
    setLoaded(false);
    setError('');
    return requestEvents()
      .then(value => setEvents(value.content || []))
      .catch(error => setError((error as Error).message))
      .finally(() => setLoaded(true));
  };
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError('');
    requestEvents()
      .then(value => { if (active) setEvents(value.content || []); })
      .catch(error => { if (active) setError((error as Error).message); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
    // requestEvents always reflects these two request parameters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, profileId]);
  return <ProfileRelationshipPanel
    title="Events"
    items={events}
    loaded={loaded}
    filterPlaceholder={kind === 'followed' ? 'Filter followed events' : 'Filter event memberships'}
    getSearchText={event => `${event.name} ${event.description || ''}`}
    renderItems={visibleEvents => <EventTileList events={visibleEvents} />}
    emptyText={kind === 'followed' ? 'No followed events yet.' : 'No event memberships yet.'}
    noMatchesText={kind === 'followed' ? 'No followed events match this filter.' : 'No event memberships match this filter.'}
    error={error}
    onRetry={load}
  />;
}
