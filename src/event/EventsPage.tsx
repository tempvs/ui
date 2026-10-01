import React, { useEffect, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import TextFilterInput from '../component/TextFilterInput';
import { DEFAULT_HOURGLASS_IMAGE_SRC } from '../component/DefaultHourglassImage';
import RefreshingImage from '../image/RefreshingImage';
import { fetchClubProfiles, fetchCurrentUserInfo, fetchUserProfileByUserId } from '../profile/profileApi';
import { Profile } from '../profile/profileTypes';
import { PeriodBadge } from '../util/periods';
import EventForm from './EventForm';
import { createEvent, EventDraft, listEvents, TempvsEvent } from './eventApi';
import './events.css';

export default function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<TempvsEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    listEvents(controller.signal).then(result => setEvents(result.content || [])).catch(error => {
      if (error.name !== 'AbortError') setError(error.message);
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => fetchCurrentUserInfo(result => {
    if (!result.currentUserId) return;
    const userId = result.currentUserId;
    let personal: Profile | null = null;
    let clubs: Profile[] = [];
    const finish = () => setProfiles([...(personal ? [personal] : []), ...clubs]);
    fetchUserProfileByUserId(userId, { onSuccess: profile => { personal = profile; finish(); }, onMissing: finish, onError: finish });
    fetchClubProfiles(userId, { onSuccess: values => { clubs = values; finish(); }, onError: finish });
  }), []);

  const save = async (draft: EventDraft) => {
    setBusy(true); setError('');
    try { const created = await createEvent(draft); navigate(`/events/${created.id}`); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };

  const normalized = query.trim().toLocaleLowerCase();
  const visible = events.filter(event => !normalized || `${event.name} ${event.description || ''}`.toLocaleLowerCase().includes(normalized));

  return <Container className="events-page">
    <div className="event-heading"><div><h1>Events</h1><p>Festivals, meetings, and other themed gatherings.</p></div>{profiles.length > 0 && !creating && <Button onClick={() => setCreating(true)}>Create event</Button>}</div>
    {error && <Alert variant="danger">{error}</Alert>}
    {creating ? <section className="event-panel"><h2>Create event</h2><EventForm profiles={profiles} busy={busy} onSave={save} onCancel={() => setCreating(false)} /></section> : <>
      <TextFilterInput value={query} onChange={setQuery} placeholder="Filter events" ariaLabel="Filter events" />
      <div className="event-card-grid">{visible.map(event => <article className="event-panel event-card" key={event.id}>
        <Link to={`/events/${event.id}`} className="event-card-image-link"><RefreshingImage image={{ resourceType: 'event', resourceId: event.id }} variant="thumbnail" fallbackSrc={DEFAULT_HOURGLASS_IMAGE_SRC} className="event-card-image" alt={`${event.name} thumbnail`} /></Link>
        <div className="event-card-content"><div className="event-period-badges">{event.periods.map(period => <PeriodBadge key={period} period={period} />)}</div>
        <h2><Link to={`/events/${event.id}`}>{event.name}</Link></h2>
        <time>{new Date(event.schedule.startsAt).toLocaleString()} · {event.schedule.timeZone}</time>
        {event.description && <p>{event.description}</p>}</div>
      </article>)}</div>
      {loading && <p role="status">Loading events…</p>}
      {!loading && !error && visible.length === 0 && <p className="event-panel">No events found.</p>}
    </>}
  </Container>;
}
