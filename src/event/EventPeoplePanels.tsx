import React, { useEffect, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { FaCheck, FaTimes, FaUserMinus } from 'react-icons/fa';
import ConfirmationModal from '../component/ConfirmationModal';
import ProfileCollectionPanel from '../profile/components/ProfileCollectionPanel';
import { buildProfileLabel } from '../profile/currentProfile';
import { fetchProfileById } from '../profile/profileApi';
import { Profile } from '../profile/profileTypes';
import {
  decideClubApplication,
  decideEventApplication,
  EventApplication,
  getClubApprovalApplications,
  getEventApplications,
  getEventFollowers,
  getEventParticipants,
  unfollowEvent,
} from './eventApi';

type Props = {
  eventId: string;
  canManage: boolean;
  ownedProfiles: Profile[];
  revision: number;
  onChanged: () => void;
  showPeople?: boolean;
  showApprovals?: boolean;
};
type Removal = { kind: 'follower'; profile: Profile } | { kind: 'participant'; profile: Profile; application: EventApplication };
const RemoveIcon = FaUserMinus as React.ComponentType<{ 'aria-hidden'?: string }>;
const ApproveIcon = FaCheck as React.ComponentType<{ 'aria-hidden'?: string }>;
const RejectIcon = FaTimes as React.ComponentType<{ 'aria-hidden'?: string }>;

function loadProfile(profileId: string): Promise<Profile | null> {
  return new Promise(resolve => fetchProfileById(profileId, { onSuccess: resolve, onMissing: () => resolve(null), onError: () => resolve(null) }));
}

export default function EventPeoplePanels({ eventId, canManage, ownedProfiles, revision, onChanged, showPeople = true, showApprovals = true }: Props) {
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [participants, setParticipants] = useState<Profile[]>([]);
  const [participantApplications, setParticipantApplications] = useState<EventApplication[]>([]);
  const [pending, setPending] = useState<EventApplication[]>([]);
  const [clubPending, setClubPending] = useState<EventApplication[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removal, setRemoval] = useState<Removal | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const load = async () => {
      try {
        let queueError = '';
        const [followerPage, participantPage, applicationPage, clubPage] = await Promise.all([
          showPeople ? getEventFollowers(eventId) : Promise.resolve({ content: [] }),
          showPeople ? getEventParticipants(eventId) : Promise.resolve({ content: [] }),
          showApprovals && canManage ? getEventApplications(eventId).catch(caught => { queueError = (caught as Error).message; return { content: [] }; }) : Promise.resolve({ content: [] }),
          ownedProfiles.length ? getClubApprovalApplications(eventId).catch(caught => { queueError ||= (caught as Error).message; return { content: [] }; }) : Promise.resolve({ content: [] }),
        ]);
        const applications = [...participantPage.content, ...applicationPage.content, ...clubPage.content];
        const ids = Array.from(new Set([...followerPage.content, ...applications.map(value => value.profileId).filter((value): value is string => Boolean(value))]));
        const loaded = (await Promise.all(ids.map(loadProfile))).filter((profile): profile is Profile => profile !== null);
        if (!active) return;
        const byId = Object.fromEntries(loaded.map(profile => [String(profile.id), profile]));
        setProfilesById(byId);
        setFollowers(followerPage.content.map(id => byId[id]).filter(Boolean));
        setParticipants(participantPage.content.map(value => value.profileId ? byId[value.profileId] : null).filter((profile): profile is Profile => Boolean(profile)));
        setParticipantApplications(participantPage.content);
        setPending(applicationPage.content); setClubPending(clubPage.content);
        setError(queueError);
      } catch (caught) { if (active) setError((caught as Error).message); }
      finally { if (active) setLoading(false); }
    };
    void load(); return () => { active = false; };
  }, [canManage, eventId, ownedProfiles.length, revision, showApprovals, showPeople]);

  const pendingProfiles = pending.map(value => value.profileId ? profilesById[value.profileId] : null).filter((profile): profile is Profile => Boolean(profile));
  const clubPendingProfiles = clubPending.map(value => value.profileId ? profilesById[value.profileId] : null).filter((profile): profile is Profile => Boolean(profile));
  const applicationFor = (values: EventApplication[], profile: Profile) => values.find(value => value.profileId === String(profile.id));

  const decide = async (application: EventApplication, decision: 'approve' | 'reject', clubDecision = false) => {
    setBusy(true); setError('');
    try {
      if (clubDecision) {
        const reviewer = ownedProfiles[0];
        if (!reviewer) throw new Error('Select an owned profile before reviewing this request.');
        await decideClubApplication(eventId, application.id, decision, String(reviewer.id));
      } else await decideEventApplication(eventId, application.id, decision);
      onChanged();
    } catch (caught) { setError((caught as Error).message); }
    finally { setBusy(false); }
  };
  const confirmRemoval = async () => {
    if (!removal) return;
    setBusy(true); setError('');
    try {
      if (removal.kind === 'follower') await unfollowEvent(eventId, String(removal.profile.id));
      else await decideEventApplication(eventId, removal.application.id, 'reject');
      setRemoval(null); onChanged();
    } catch (caught) { setError((caught as Error).message); }
    finally { setBusy(false); }
  };

  return <div className="event-people-panels">
    {error && <Alert variant="danger">{error}</Alert>}
    <div className="event-people-grid">
      {showPeople && <ProfileCollectionPanel title="Followers" profiles={followers} filterPlaceholder="Filter followers" emptyText="No followers yet." loading={loading} renderActions={profile => canManage ? <Button size="sm" variant="outline-danger" aria-label="Remove follower" title="Remove follower" onClick={() => setRemoval({ kind: 'follower', profile })}><RemoveIcon aria-hidden="true" /></Button> : null} />}
      {showPeople && <ProfileCollectionPanel title="Participants" profiles={participants} filterPlaceholder="Filter participants" emptyText="No approved participants yet." loading={loading} renderActions={profile => canManage ? <Button size="sm" variant="outline-danger" aria-label="Remove participant" title="Remove participant" onClick={() => { const application = applicationFor(participantApplications, profile); if (application) setRemoval({ kind: 'participant', profile, application }); }}><RemoveIcon aria-hidden="true" /></Button> : null} />}
      {showApprovals && canManage && <ProfileCollectionPanel title="Participation applications" profiles={pendingProfiles} filterPlaceholder="Filter applications" emptyText="No applications are waiting for event approval." loading={loading} renderActions={profile => { const application = applicationFor(pending, profile); return application ? <div className="event-review-actions"><Button size="sm" variant="outline-success" disabled={busy} aria-label="Approve application" onClick={() => void decide(application, 'approve')}><ApproveIcon aria-hidden="true" /></Button><Button size="sm" variant="outline-danger" disabled={busy} aria-label="Reject application" onClick={() => void decide(application, 'reject')}><RejectIcon aria-hidden="true" /></Button></div> : null; }} />}
      {clubPending.length > 0 && <ProfileCollectionPanel title="Club approval requests" profiles={clubPendingProfiles} filterPlaceholder="Filter club requests" emptyText="No club requests require your approval." loading={loading} renderActions={profile => { const application = applicationFor(clubPending, profile); return application ? <div className="event-review-actions"><Button size="sm" variant="outline-success" disabled={busy} aria-label="Approve club application" onClick={() => void decide(application, 'approve', true)}><ApproveIcon aria-hidden="true" /></Button><Button size="sm" variant="outline-danger" disabled={busy} aria-label="Reject club application" onClick={() => void decide(application, 'reject', true)}><RejectIcon aria-hidden="true" /></Button></div> : null; }} />}
    </div>
    <ConfirmationModal show={removal != null} title={removal?.kind === 'follower' ? 'Remove follower' : 'Remove participant'} message={removal ? <>Remove <strong>{buildProfileLabel(removal.profile)}</strong> from this event?</> : ''} confirmLabel="Remove" busy={busy} onHide={() => { if (!busy) setRemoval(null); }} onConfirm={() => void confirmRemoval()} />
  </div>;
}
