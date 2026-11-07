import React, { useEffect, useRef, useState } from 'react';
import ProfileRelationshipPanel from '../profile/components/ProfileRelationshipPanel';
import EventTileList from './EventTileList';
import { getFollowedEvents, getParticipatingEvents, TempvsEvent } from './eventApi';

export default function ProfileEventsPanel({ profileId, kind, hideWhenEmpty = false }: { profileId: string; kind: 'followed' | 'participating'; hideWhenEmpty?: boolean }) {
  const [events, setEvents] = useState<TempvsEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const loadMore = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true;
    let fetching = false;
    let nextToken: string | undefined;
    setLoaded(false);
    setEvents([]);
    setHasMore(false);
    setError('');
    const load = async () => {
      if (!active || fetching) return;
      fetching = true;
      setLoading(true);
      setError('');
      try {
        const value = await (kind === 'followed' ? getFollowedEvents(profileId, nextToken) : getParticipatingEvents(profileId, nextToken));
        if (!active) return;
        setEvents(current => Array.from(new Map([...current, ...(value.content || [])].map(event => [event.id, event])).values()));
        nextToken = value.nextToken;
        setHasMore(Boolean(nextToken));
      } catch (cause) {
        if (active) setError((cause as Error).message);
      } finally {
        fetching = false;
        if (active) { setLoaded(true); setLoading(false); }
      }
    };
    loadMore.current = () => { void load(); };
    void load();
    return () => { active = false; };
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
    onRetry={() => loadMore.current()}
    loadingMore={loading && loaded}
    onReachEnd={hasMore && !loading ? () => loadMore.current() : undefined}
    hideWhenEmpty={hideWhenEmpty}
  />;
}
