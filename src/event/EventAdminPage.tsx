import React, { useEffect, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ConfirmationModal from '../component/ConfirmationModal';
import { fetchClubProfiles, fetchCurrentUserInfo, fetchProfileById, fetchUserProfileByUserId } from '../profile/profileApi';
import { Profile } from '../profile/profileTypes';
import EventManagers from './EventManagers';
import EventPeoplePanels from './EventPeoplePanels';
import { deleteEvent, getEvent, TempvsEvent } from './eventApi';
import './events.css';

export default function EventAdminPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<TempvsEvent | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [ownedProfiles, setOwnedProfiles] = useState<Profile[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getEvent(eventId, controller.signal).then(value => {
      setEvent(value);
      fetchProfileById(value.ownerProfileId, { onSuccess: setOwner, onMissing: () => undefined, onError: () => undefined });
    }).catch(caught => { if ((caught as Error).name !== 'AbortError') setError((caught as Error).message); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [eventId]);

  useEffect(() => fetchCurrentUserInfo(result => {
    if (!result.currentUserId) return;
    let personal: Profile | null = null;
    let clubs: Profile[] = [];
    const finish = () => setOwnedProfiles([...(personal ? [personal] : []), ...clubs]);
    fetchUserProfileByUserId(result.currentUserId, { onSuccess: value => { personal = value; finish(); }, onMissing: finish, onError: finish });
    fetchClubProfiles(result.currentUserId, { onSuccess: values => { clubs = values; finish(); }, onError: finish });
  }), []);

  const canManage = Boolean(event && ownedProfiles.some(profile => String(profile.id) === event.ownerProfileId || event.adminProfileIds.includes(String(profile.id))));
  const isOwner = Boolean(event && ownedProfiles.some(profile => String(profile.id) === event.ownerProfileId));

  const remove = async () => {
    if (!event) return;
    setBusy(true); setError('');
    try { await deleteEvent(event.id); navigate('/events', { replace: true }); }
    catch (caught) { setError((caught as Error).message); setDeleting(false); setBusy(false); }
  };

  return <Container className="events-page">
    <Link to={`/events/${eventId}`}>Back to event</Link>
    {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
    {loading ? <p role="status">Loading event administration…</p> : !event ? null : !canManage ? <Alert variant="danger" className="mt-3">Event administration is available only to the owner and event admins.</Alert> : <article className="event-panel event-detail mt-3">
      <div className="event-heading"><div><h1>Admin actions</h1><p className="text-muted mb-0">Review participation requests and manage {event.name}.</p></div><Link className="btn btn-outline-dark" to={`/events/${event.id}`}>View event</Link></div>
      <EventPeoplePanels eventId={event.id} canManage ownedProfiles={ownedProfiles} revision={revision} showPeople={false} onChanged={() => setRevision(value => value + 1)} />
      <EventManagers event={event} owner={owner} canManageAdmins={isOwner} onChange={setEvent} />
      {isOwner && <Button variant="outline-danger" className="mt-4" disabled={busy} onClick={() => setDeleting(true)}>Delete event</Button>}
    </article>}
    <ConfirmationModal show={deleting} title="Delete event" message="Are you sure you want to delete this event?" confirmLabel="Delete event" busy={busy} onConfirm={() => void remove()} onHide={() => { if (!busy) setDeleting(false); }} />
  </Container>;
}
