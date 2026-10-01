import React, { useEffect, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import EventTileList from './EventTileList';
import { getFollowedEvents, getParticipatingEvents, TempvsEvent } from './eventApi';

export default function ProfileEventsPanel({ profileId, kind }: { profileId: string; kind: 'followed' | 'participating' }) {
  const [events, setEvents] = useState<TempvsEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const load = () => (kind === 'followed' ? getFollowedEvents(profileId) : getParticipatingEvents(profileId)).then(value => setEvents(value.content || [])).catch(error => setError((error as Error).message)).finally(() => setLoaded(true));
  useEffect(() => { let active = true; setLoaded(false); (kind === 'followed' ? getFollowedEvents(profileId) : getParticipatingEvents(profileId)).then(value => { if (active) setEvents(value.content || []); }).catch(error => { if (active) setError((error as Error).message); }).finally(() => { if (active) setLoaded(true); }); return () => { active = false; }; }, [kind, profileId]);
  if (!loaded || (!error && events.length === 0)) return null;
  return <section className="club-panel profile-events-panel mt-3"><h2>{kind === 'followed' ? 'Events followed' : 'Events participated'}</h2>
    {error && <Alert variant="danger">{error} <Button variant="link" onClick={load}>Retry</Button></Alert>}
    <EventTileList events={events} />
  </section>;
}
