import React, { useEffect, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ConfirmationModal from '../component/ConfirmationModal';
import { fetchClubProfiles, fetchCurrentUserInfo, fetchProfileById, fetchUserProfileByUserId } from '../profile/profileApi';
import { Profile } from '../profile/profileTypes';
import { PeriodBadge } from '../util/periods';
import EventForm from './EventForm';
import { deleteEvent, EventDraft, getEvent, TempvsEvent, updateEvent } from './eventApi';
import './events.css';

export default function EventPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<TempvsEvent | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [ownedProfiles, setOwnedProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getEvent(eventId, controller.signal).then(value => {
      setItem(value);
      fetchProfileById(value.ownerProfileId, { onSuccess: setOwner, onError: () => undefined, onMissing: () => undefined });
    }).catch(error => setError(error.message));
    return () => controller.abort();
  }, [eventId]);

  useEffect(() => fetchCurrentUserInfo(result => {
    if (!result.currentUserId) return;
    let personal: Profile | null = null, clubs: Profile[] = [];
    const finish = () => setOwnedProfiles([...(personal ? [personal] : []), ...clubs]);
    fetchUserProfileByUserId(result.currentUserId, { onSuccess: value => { personal = value; finish(); }, onMissing: finish, onError: finish });
    fetchClubProfiles(result.currentUserId, { onSuccess: values => { clubs = values; finish(); }, onError: finish });
  }), []);

  const canManage = Boolean(item && ownedProfiles.some(profile => String(profile.id) === item.ownerProfileId || item.adminProfileIds.includes(String(profile.id))));
  const save = async (draft: EventDraft) => {
    if (!item) return;
    setBusy(true); setError('');
    try { setItem(await updateEvent(item.id, draft, item.version)); setEditing(false); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!item) return;
    setBusy(true); setError('');
    try { await deleteEvent(item.id); navigate('/events', { replace: true }); }
    catch (error) { setError((error as Error).message); setBusy(false); setConfirmDelete(false); }
  };

  if (error && !item) return <Container className="events-page"><Alert variant="danger">{error}</Alert><Link to="/events">All events</Link></Container>;
  if (!item) return <Container className="events-page"><p role="status">Loading event…</p></Container>;
  if (editing) return <Container className="events-page"><section className="event-panel"><h1>Edit event</h1>{error && <Alert variant="danger">{error}</Alert>}<EventForm profiles={ownedProfiles} initial={item} busy={busy} onSave={save} onCancel={() => setEditing(false)} /></section></Container>;

  const ownerName = owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.nickName || owner.alias : item.ownerProfileId;
  return <Container className="events-page">
    {error && <Alert variant="danger">{error}</Alert>}
    <article className="event-panel event-detail">
      <div className="event-heading"><div><div className="event-period-badges">{item.periods.map(period => <PeriodBadge key={period} period={period} />)}</div><h1>{item.name}</h1></div>{canManage && <div className="event-actions"><Button variant="outline-secondary" onClick={() => setEditing(true)}>Edit</Button><Button variant="outline-danger" onClick={() => setConfirmDelete(true)}>Delete</Button></div>}</div>
      <p className="event-owner">Owned by <Link to={`/profile/${item.ownerProfileId}`}>{ownerName}</Link></p>
      <p className="event-description">{item.description || 'No description.'}</p>
      <h2>Schedule</h2><p>{new Date(item.schedule.startsAt).toLocaleString()} – {new Date(item.schedule.endsAt).toLocaleString()} ({item.schedule.timeZone})</p>
      {item.schedule.kind === 'RECURRING' && <p>Repeats every {item.schedule.recurrence?.interval} {item.schedule.recurrence?.frequency.toLocaleLowerCase()}.</p>}
      <h2>Occurrences</h2><ul className="event-occurrences">{(item.upcomingOccurrences || []).map(occurrence => <li key={occurrence.id}><time>{new Date(occurrence.startsAt).toLocaleString()}</time><span>{occurrence.status}</span></li>)}</ul>
    </article>
    <ConfirmationModal show={confirmDelete} title="Delete event" message="Are you sure you want to delete this event?" confirmLabel="Delete" busy={busy} onConfirm={remove} onHide={() => setConfirmDelete(false)} />
  </Container>;
}
