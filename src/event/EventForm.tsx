import React, { FormEvent, useMemo, useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import ProfilePicker, { ProfilePickerOption } from '../profile/components/ProfilePicker';
import { Profile } from '../profile/profileTypes';
import { PERIODS, Period, getPeriodLabel } from '../util/periods';
import { useIntl } from 'react-intl';
import { EventDraft, TempvsEvent } from './eventApi';

type Props = {
  profiles: Profile[];
  initial?: TempvsEvent;
  busy?: boolean;
  onSave: (draft: EventDraft) => Promise<void> | void;
  onCancel: () => void;
};

function localInput(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function EventForm({ profiles, initial, busy = false, onSave, onCancel }: Props) {
  const intl = useIntl();
  const profileOptions = useMemo<ProfilePickerOption[]>(() => profiles.map(profile => ({
    value: String(profile.id),
    label: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.nickName || profile.alias || 'Profile',
    profile,
  })), [profiles]);
  const [ownerProfileId, setOwnerProfileId] = useState(initial?.ownerProfileId || profileOptions[0]?.value || '');
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [periods, setPeriods] = useState<Period[]>(initial?.periods || []);
  const [startsAt, setStartsAt] = useState(localInput(initial?.schedule.startsAt));
  const [endsAt, setEndsAt] = useState(localInput(initial?.schedule.endsAt));
  const [timeZone, setTimeZone] = useState(initial?.schedule.timeZone || 'UTC');
  const [kind, setKind] = useState<'ONE_TIME' | 'RECURRING'>(initial?.schedule.kind || 'ONE_TIME');
  const [frequency, setFrequency] = useState(initial?.schedule.recurrence?.frequency || 'WEEKLY');
  const [interval, setInterval] = useState(initial?.schedule.recurrence?.interval || 1);
  const [count, setCount] = useState(initial?.schedule.recurrence?.count || 4);
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!ownerProfileId || !name.trim() || periods.length === 0 || !startsAt || !endsAt) {
      setError('Owner, name, period, start, and end are required.');
      return;
    }
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (end <= start) {
      setError('End date must be after start date.');
      return;
    }
    const schedule: EventDraft['schedule'] = {
      kind,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      timeZone,
      ...(kind === 'RECURRING' ? { recurrence: { frequency, interval, count } } : {}),
    };
    onSave({ ownerProfileId, name: name.trim(), description: description.trim() || null, periods, schedule });
  };

  const togglePeriod = (period: Period) => setPeriods(current => current.includes(period)
    ? current.filter(value => value !== period)
    : [...current, period]);

  return <Form className="event-form" onSubmit={submit}>
    {error && <Alert variant="danger">{error}</Alert>}
    <Form.Group className="mb-3">
      <Form.Label>Owner</Form.Label>
      <ProfilePicker options={profileOptions} value={ownerProfileId} onChange={setOwnerProfileId} ariaLabel="Event owner profile" disabled={Boolean(initial)} />
    </Form.Group>
    <Form.Group className="mb-3"><Form.Label>Name</Form.Label><Form.Control value={name} maxLength={200} onChange={event => setName(event.target.value)} required /></Form.Group>
    <Form.Group className="mb-3"><Form.Label>Description</Form.Label><Form.Control as="textarea" rows={4} value={description} maxLength={10000} onChange={event => setDescription(event.target.value)} /></Form.Group>
    <fieldset className="mb-3"><legend className="form-label">Periods</legend><div className="event-period-options">
      {PERIODS.map(period => <Form.Check key={period} type="checkbox" id={`event-period-${period}`} checked={periods.includes(period)} label={getPeriodLabel(intl, period)} onChange={() => togglePeriod(period)} />)}
    </div></fieldset>
    <Form.Group className="mb-3"><Form.Label>Schedule</Form.Label><Form.Select value={kind} onChange={event => setKind(event.target.value as 'ONE_TIME' | 'RECURRING')}><option value="ONE_TIME">One-time event</option><option value="RECURRING">Recurring event</option></Form.Select></Form.Group>
    <div className="event-date-grid">
      <Form.Group><Form.Label>Starts</Form.Label><Form.Control type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} required /></Form.Group>
      <Form.Group><Form.Label>Ends</Form.Label><Form.Control type="datetime-local" value={endsAt} onChange={event => setEndsAt(event.target.value)} required /></Form.Group>
      <Form.Group><Form.Label>Time zone</Form.Label><Form.Select value={timeZone} onChange={event => setTimeZone(event.target.value)}><option value="UTC">UTC</option><option value="America/New_York">America/New_York</option><option value="Europe/London">Europe/London</option><option value="Europe/Prague">Europe/Prague</option><option value="Europe/Warsaw">Europe/Warsaw</option></Form.Select></Form.Group>
    </div>
    {kind === 'RECURRING' && <div className="event-recurrence-grid mt-3">
      <Form.Group><Form.Label>Repeat</Form.Label><Form.Select value={frequency} onChange={event => setFrequency(event.target.value as typeof frequency)}><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option></Form.Select></Form.Group>
      <Form.Group><Form.Label>Every</Form.Label><Form.Control type="number" min={1} max={12} value={interval} onChange={event => setInterval(Number(event.target.value))} /></Form.Group>
      <Form.Group><Form.Label>Number of dates</Form.Label><Form.Control type="number" min={1} max={365} value={count} onChange={event => setCount(Number(event.target.value))} /></Form.Group>
    </div>}
    <div className="event-form-actions"><Button type="button" variant="outline-secondary" onClick={onCancel} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save event'}</Button></div>
  </Form>;
}
