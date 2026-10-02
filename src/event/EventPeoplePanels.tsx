import React, { useEffect, useState } from 'react';
import { Alert, Button, Modal } from 'react-bootstrap';
import { FaCheck, FaTimes, FaUserMinus } from 'react-icons/fa';
import ConfirmationModal from '../component/ConfirmationModal';
import { Club, getClub } from '../club/clubApi';
import ProfileCollectionPanel from '../profile/components/ProfileCollectionPanel';
import { buildProfileLabel } from '../profile/currentProfile';
import { fetchProfileById } from '../profile/profileApi';
import { Profile } from '../profile/profileTypes';
import {
  decideEventApplication,
  EventApplication,
  getEventApplications,
  getEventFollowers,
  getEventParticipants,
  removeEventClubParticipation,
  unfollowEvent,
} from './eventApi';
import EventParticipationCollectionPanel from './EventParticipationCollectionPanel';

type Props = {
  eventId: string;
  canManage: boolean;
  revision: number;
  onChanged: () => void;
  showPeople?: boolean;
  showApprovals?: boolean;
};
type Removal = { kind: 'follower'; profile: Profile } | { kind: 'participant'; profile: Profile; application: EventApplication };
type ClubRemoval = { club: Club; applications: EventApplication[] };
const RemoveIcon = FaUserMinus as React.ComponentType<{ 'aria-hidden'?: string }>;
const ApproveIcon = FaCheck as React.ComponentType<{ 'aria-hidden'?: string }>;
const RejectIcon = FaTimes as React.ComponentType<{ 'aria-hidden'?: string }>;

function loadProfile(profileId: string): Promise<Profile | null> {
  return new Promise(resolve => fetchProfileById(profileId, { onSuccess: resolve, onMissing: () => resolve(null), onError: () => resolve(null) }));
}

export default function EventPeoplePanels({ eventId, canManage, revision, onChanged, showPeople = true, showApprovals = true }: Props) {
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [participantApplications, setParticipantApplications] = useState<EventApplication[]>([]);
  const [pending, setPending] = useState<EventApplication[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [clubsById, setClubsById] = useState<Record<string, Club>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const [clubRemoval, setClubRemoval] = useState<ClubRemoval | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const load = async () => {
      try {
        let queueError = '';
        const [followerPage, participantPage, applicationPage] = await Promise.all([
          showPeople ? getEventFollowers(eventId) : Promise.resolve({ content: [] }),
          showPeople ? getEventParticipants(eventId) : Promise.resolve({ content: [] }),
          showApprovals && canManage ? getEventApplications(eventId).catch(caught => { queueError = (caught as Error).message; return { content: [] }; }) : Promise.resolve({ content: [] }),
        ]);
        const applications = [...participantPage.content, ...applicationPage.content];
        const ids = Array.from(new Set([...followerPage.content, ...applications.map(value => value.profileId).filter((value): value is string => Boolean(value))]));
        const clubIds = Array.from(new Set(applications.map(value => value.clubId).filter((value): value is string => Boolean(value))));
        const [loaded, loadedClubs] = await Promise.all([
          Promise.all(ids.map(loadProfile)),
          Promise.all(clubIds.map(clubId => getClub(clubId).catch(() => null))),
        ]);
        const availableProfiles = loaded.filter((profile): profile is Profile => profile !== null);
        if (!active) return;
        const byId = Object.fromEntries(availableProfiles.map(profile => [String(profile.id), profile]));
        setProfilesById(byId);
        setClubsById(Object.fromEntries(loadedClubs.filter((club): club is Club => club !== null).map(club => [String(club.id), club])));
        setFollowers(followerPage.content.map(id => byId[id]).filter(Boolean));
        setParticipantApplications(participantPage.content);
        setPending(applicationPage.content);
        setError(queueError);
      } catch (caught) { if (active) setError((caught as Error).message); }
      finally { if (active) setLoading(false); }
    };
    void load(); return () => { active = false; };
  }, [canManage, eventId, revision, showApprovals, showPeople]);

  const decide = async (application: EventApplication, decision: 'approve' | 'reject') => {
    setBusy(true); setError('');
    try {
      await decideEventApplication(eventId, application.id, decision);
      onChanged();
    } catch (caught) { setError((caught as Error).message); }
    finally { setBusy(false); }
  };
  const confirmRemoval = async () => {
    if (!removal) return;
    setBusy(true); setError('');
    try {
      if (removal.kind === 'follower') await unfollowEvent(eventId, String(removal.profile.id));
      else await decideEventApplication(eventId, removal.application.id, 'complete');
      setRemoval(null); onChanged();
    } catch (caught) { setError((caught as Error).message); }
    finally { setBusy(false); }
  };
  const confirmClubRemoval = async (mode: 'REMOVE_ALL' | 'KEEP_PARTICIPANTS') => {
    if (!clubRemoval) return;
    setBusy(true); setError('');
    try {
      await removeEventClubParticipation(eventId, clubRemoval.club.id, mode);
      setClubRemoval(null); onChanged();
    } catch (caught) { setError((caught as Error).message); }
    finally { setBusy(false); }
  };

  return <div className="event-people-panels">
    {error && <Alert variant="danger">{error}</Alert>}
    <div className="event-people-grid">
      {showPeople && <ProfileCollectionPanel title="Followers" profiles={followers} filterPlaceholder="Filter followers" emptyText="No followers yet." loading={loading} renderActions={profile => canManage ? <Button size="sm" variant="outline-danger" aria-label="Remove follower" title="Remove follower" onClick={() => setRemoval({ kind: 'follower', profile })}><RemoveIcon aria-hidden="true" /></Button> : null} />}
      {showPeople && <EventParticipationCollectionPanel title="Participants" applications={participantApplications} profilesById={profilesById} clubsById={clubsById} filterPlaceholder="Filter participants" emptyText="No approved participants yet." loading={loading} renderActions={(application, profile) => canManage ? <Button size="sm" variant="outline-danger" aria-label="Remove participant" title="Remove participant" onClick={() => setRemoval({ kind: 'participant', profile, application })}><RemoveIcon aria-hidden="true" /></Button> : null} renderClubActions={canManage ? (club, applications) => <Button className="club-icon-action" size="sm" variant="outline-danger" aria-label="Remove club participation" title="Remove club participation" onClick={() => setClubRemoval({ club, applications })}><RemoveIcon aria-hidden="true" /></Button> : undefined} />}
      {showApprovals && canManage && <EventParticipationCollectionPanel title="Participation applications" applications={pending} profilesById={profilesById} clubsById={clubsById} filterPlaceholder="Filter applications" emptyText="No applications are waiting for event approval." loading={loading} renderActions={application => <div className="event-review-actions"><Button size="sm" variant="outline-success" disabled={busy} aria-label="Approve application" onClick={() => void decide(application, 'approve')}><ApproveIcon aria-hidden="true" /></Button><Button size="sm" variant="outline-danger" disabled={busy} aria-label="Reject application" onClick={() => void decide(application, 'reject')}><RejectIcon aria-hidden="true" /></Button></div>} />}
    </div>
    <ConfirmationModal show={removal != null} title={removal?.kind === 'follower' ? 'Remove follower' : 'Remove participant'} message={removal ? <>Remove <strong>{buildProfileLabel(removal.profile)}</strong> from this event?</> : ''} confirmLabel="Remove" busy={busy} onHide={() => { if (!busy) setRemoval(null); }} onConfirm={() => void confirmRemoval()} />
    <Modal show={clubRemoval != null} onHide={() => { if (!busy) setClubRemoval(null); }} centered>
      <Modal.Header closeButton={!busy}><Modal.Title>Remove club participation</Modal.Title></Modal.Header>
      <Modal.Body>Do you want to remove <strong>{clubRemoval?.club.name}</strong> together with all its participants, or remove only the club and keep those profiles as individual participants?</Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" disabled={busy} onClick={() => setClubRemoval(null)}>Cancel</Button>
        <Button variant="outline-danger" disabled={busy} onClick={() => void confirmClubRemoval('KEEP_PARTICIPANTS')}>Remove club only</Button>
        <Button variant="danger" disabled={busy} onClick={() => void confirmClubRemoval('REMOVE_ALL')}>Remove club and participants</Button>
      </Modal.Footer>
    </Modal>
  </div>;
}
