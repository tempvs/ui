import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { FaCheck, FaTimes } from 'react-icons/fa';
import { Link } from 'react-router-dom';

import TextFilterInput from '../component/TextFilterInput';
import { buildProfileLabel } from '../profile/currentProfile';
import { fetchProfileById } from '../profile/profileApi';
import ProfileThumbnailLink from '../profile/components/ProfileThumbnailLink';
import { Profile } from '../profile/profileTypes';
import {
  decideClubApplication,
  EventApplication,
  getClubEventParticipationRequests,
  getEvent,
  TempvsEvent,
} from './eventApi';

type RequestRow = {
  application: EventApplication;
  event: TempvsEvent | null;
  profile: Profile | null;
};

type Props = {
  clubId: string | number;
  reviewerProfileId?: string;
};

const ApproveIcon = FaCheck as React.ComponentType<{ 'aria-hidden'?: string }>;
const RejectIcon = FaTimes as React.ComponentType<{ 'aria-hidden'?: string }>;

function loadProfile(profileId: string): Promise<Profile | null> {
  return new Promise(resolve => fetchProfileById(profileId, {
    onSuccess: resolve,
    onMissing: () => resolve(null),
    onError: () => resolve(null),
  }));
}

export default function ClubEventRequestsPanel({ clubId, reviewerProfileId }: Props) {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getClubEventParticipationRequests(clubId)
      .then(async page => {
        const eventReads = new Map<string, Promise<TempvsEvent | null>>();
        const profileReads = new Map<string, Promise<Profile | null>>();
        const loaded = await Promise.all(page.content.map(async application => {
          const eventId = String(application.eventId);
          const profileId = application.profileId ? String(application.profileId) : '';
          if (!eventReads.has(eventId)) eventReads.set(eventId, getEvent(eventId).catch(() => null));
          if (profileId && !profileReads.has(profileId)) profileReads.set(profileId, loadProfile(profileId));
          return {
            application,
            event: await eventReads.get(eventId)!,
            profile: profileId ? await profileReads.get(profileId)! : null,
          };
        }));
        if (active) setRows(loaded);
      })
      .catch(caught => { if (active) setError((caught as Error).message || 'Unable to load event participation requests.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clubId, revision]);

  const visibleRows = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    if (!query) return rows;
    return rows.filter(row => [
      row.event?.name,
      row.profile ? buildProfileLabel(row.profile) : undefined,
    ].some(value => value?.toLocaleLowerCase().includes(query)));
  }, [filter, rows]);

  const decide = async (application: EventApplication, decision: 'approve' | 'reject') => {
    if (!reviewerProfileId) {
      setError('A personal profile is required to review event participation requests.');
      return;
    }
    setBusyId(application.id);
    setError('');
    try {
      await decideClubApplication(application.eventId, application.id, decision, reviewerProfileId);
      setRows(current => current.filter(row => row.application.id !== application.id));
    } catch (caught) {
      setError((caught as Error).message || 'Unable to review this event participation request.');
    } finally {
      setBusyId(null);
    }
  };

  return <section className="club-panel">
    <div className="club-list-heading">
      <h2>Event participation requests</h2>
      <div className="d-flex gap-2">
        <TextFilterInput value={filter} onChange={setFilter} placeholder="Filter event requests" ariaLabel="Filter event requests" className="club-list-filter" />
        <Button size="sm" variant="outline-secondary" disabled={loading || busyId != null} onClick={() => setRevision(value => value + 1)}>Refresh</Button>
      </div>
    </div>
    {error && <Alert variant="danger">{error}</Alert>}
    {!loading && !error && rows.length === 0 && <p>No event participation requests are waiting for club approval.</p>}
    {!loading && !error && rows.length > 0 && visibleRows.length === 0 && <p>No event requests match this filter.</p>}
    {visibleRows.length > 0 && <div className="club-scroll-list" role="region" aria-label="Event participation requests">
      <ul className="club-member-list">
        {visibleRows.map(row => <li key={`${row.application.eventId}:${row.application.id}`}>
          <div className="profile-list-entry club-event-request-entry">
            {row.profile ? <ProfileThumbnailLink profile={row.profile} /> : <span>Profile unavailable</span>}
            <span className="club-event-request-event">
              {row.event ? <Link to={`/events/${row.event.id}`}>{row.event.name}</Link> : 'Event unavailable'}
            </span>
          </div>
          <div className="club-actions">
            <Button className="club-icon-action" size="sm" variant="outline-success" disabled={busyId != null} aria-label="Approve event participation request" title="Approve" onClick={() => void decide(row.application, 'approve')}><ApproveIcon aria-hidden="true" /></Button>
            <Button className="club-icon-action" size="sm" variant="outline-danger" disabled={busyId != null} aria-label="Reject event participation request" title="Reject" onClick={() => void decide(row.application, 'reject')}><RejectIcon aria-hidden="true" /></Button>
          </div>
        </li>)}
      </ul>
    </div>}
    {loading && <p role="status">Loading event participation requests…</p>}
  </section>;
}
