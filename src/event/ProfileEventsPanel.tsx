import React, { useEffect, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { FaTimes } from 'react-icons/fa';
import ConfirmationModal from '../component/ConfirmationModal';
import EventTileList from './EventTileList';
import { cancelEventApplication, getFollowedEvents, getParticipatingEvents, TempvsEvent, unfollowEvent } from './eventApi';

const RemoveIcon = FaTimes as React.ComponentType;

export default function ProfileEventsPanel({ profileId, kind, editable }: { profileId: string; kind: 'followed' | 'participating'; editable: boolean }) {
  const [events, setEvents] = useState<TempvsEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<TempvsEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => (kind === 'followed' ? getFollowedEvents(profileId) : getParticipatingEvents(profileId)).then(value => setEvents(value.content || [])).catch(error => setError((error as Error).message)).finally(() => setLoaded(true));
  useEffect(() => { let active = true; setLoaded(false); (kind === 'followed' ? getFollowedEvents(profileId) : getParticipatingEvents(profileId)).then(value => { if (active) setEvents(value.content || []); }).catch(error => { if (active) setError((error as Error).message); }).finally(() => { if (active) setLoaded(true); }); return () => { active = false; }; }, [kind, profileId]);
  if (!loaded || (!error && events.length === 0)) return null;
  const remove = async () => {
    if (!target) return;
    setBusy(true); setError('');
    try {
      if (kind === 'followed') await unfollowEvent(target.id, profileId);
      else {
        const occurrenceId = target.applicationOccurrenceId || target.upcomingOccurrences?.[0]?.id;
        if (!occurrenceId) throw new Error('The event occurrence is unavailable.');
        await cancelEventApplication(target.id, occurrenceId, profileId);
      }
      setEvents(current => current.filter(event => event.id !== target.id)); setTarget(null);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="club-panel profile-events-panel mt-3"><h2>{kind === 'followed' ? 'Events followed' : 'Events participated'}</h2>
    {error && <Alert variant="danger">{error} <Button variant="link" onClick={load}>Retry</Button></Alert>}
    <EventTileList events={events} renderActions={event => editable ? <Button size="sm" variant="outline-danger" aria-label={kind === 'followed' ? 'Unfollow event' : 'Cancel participation'} onClick={() => setTarget(event)}><RemoveIcon /></Button> : null} />
    <ConfirmationModal show={Boolean(target)} title={kind === 'followed' ? 'Unfollow event' : 'Cancel participation'} message={kind === 'followed' ? 'Are you sure you want to unfollow this event?' : 'Are you sure you want to cancel participation in this event?'} confirmLabel="Confirm" busy={busy} onConfirm={remove} onHide={() => setTarget(null)} />
  </section>;
}
