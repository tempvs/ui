import React, { useEffect, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Club, getProfileClubs } from '../club/clubApi';
import ConfirmationModal from '../component/ConfirmationModal';
import { Profile } from '../profile/profileTypes';
import { applyForEvent, cancelEventApplication, EventApplication } from './eventApi';

type Props = {
  eventId: string;
  occurrenceId: string;
  profile: Profile;
  application: EventApplication | null;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
  onChange: (application: EventApplication | null) => void;
  onChanged: () => void;
};

const statusLabels: Record<EventApplication['status'], string> = {
  CLUB_PENDING: 'Waiting for club approval',
  PENDING: 'Waiting for event approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  COMPLETED: 'Completed',
};

export default function EventApplicationActions({ eventId, occurrenceId, profile, application, busy, onBusy, onError, onChange, onChanged }: Props) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  useEffect(() => {
    let active = true;
    getProfileClubs(profile.id).then(values => { if (active) { setClubs(values); setClubId(values[0] ? String(values[0].id) : ''); } }).catch(() => { if (active) setClubs([]); });
    return () => { active = false; };
  }, [profile.id]);

  const submit = async (participationType: 'INDIVIDUAL' | 'CLUB') => {
    onBusy(true); onError('');
    try {
      const created = await applyForEvent(eventId, occurrenceId, String(profile.id), 'TENTATIVE', participationType, participationType === 'CLUB' ? clubId : undefined);
      onChange(created); onChanged();
    } catch (caught) { onError((caught as Error).message); }
    finally { onBusy(false); }
  };
  const cancel = async () => {
    onBusy(true); onError('');
    try {
      await cancelEventApplication(eventId, occurrenceId, String(profile.id));
      onChange(null); setConfirmCancel(false); onChanged();
    } catch (caught) { onError((caught as Error).message); }
    finally { onBusy(false); }
  };

  if (application && application.status !== 'REJECTED' && application.status !== 'WITHDRAWN' && application.status !== 'COMPLETED') return <div className="event-application-actions">
    <span className="text-muted small">{statusLabels[application.status]}</span>
    <Button size="sm" variant="outline-danger" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel participation</Button>
    <ConfirmationModal show={confirmCancel} title="Cancel participation" message="Are you sure you want to cancel this event participation request?" confirmLabel="Cancel participation" busy={busy} onHide={() => { if (!busy) setConfirmCancel(false); }} onConfirm={() => void cancel()} />
  </div>;

  return <div className="event-application-actions">
    {application && <span className="text-muted small">Previous participation ended; you can apply again.</span>}
    <Button size="sm" variant="dark" disabled={busy} onClick={() => void submit('INDIVIDUAL')}>Participate individually</Button>
    <div className="event-club-application">
      <Form.Select size="sm" aria-label="Club to participate with" value={clubId} disabled={busy || clubs.length === 0} onChange={event => setClubId(event.target.value)}>
        {clubs.length === 0 && <option value="">No club memberships</option>}
        {clubs.map(club => <option key={String(club.id)} value={String(club.id)}>{club.name}</option>)}
      </Form.Select>
      <Button size="sm" variant="outline-dark" disabled={busy || !clubId} onClick={() => void submit('CLUB')}>Participate with club</Button>
    </div>
  </div>;
}
