import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Col, Container, Modal, Row } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { FaSignOutAlt } from 'react-icons/fa';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Spinner from '../component/Spinner';
import { fetchClubProfiles, fetchCurrentUserInfo, fetchOwnerUserProfile } from '../profile/profileApi';
import { Profile } from '../profile/profileTypes';
import { buildProfileLabel } from '../profile/currentProfile';
import { PeriodBadge } from '../util/periods';
import { Club, ClubDraft, addAdmin, deleteClub, detachProfile, followClub, getClub, getClubFollowState, getParticipants, isClubServiceUnavailable, removeAdmin, requestJoin, unfollowClub, updateClub } from './clubApi';
import ClubForm from './ClubForm';
import ClubFollowModal from './ClubFollowModal';
import ClubFollowersPanel from './ClubFollowersPanel';
import ProfilePicker from './ProfilePicker';
import JoinRequestsPanel from './JoinRequestsPanel';
import ClubPhotoPanel from './ClubPhotoPanel';
import './clubs.css';

const LeaveIcon = FaSignOutAlt as React.ComponentType<{ 'aria-hidden'?: string }>;

export default function ClubPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const intl = useIntl();
  const t = (key: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${key}`, defaultMessage });
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [ownedClubProfiles, setOwnedClubProfiles] = useState<Profile[]>([]);
  const [ownedUserProfile, setOwnedUserProfile] = useState<Profile | null>(null);
  const [followingProfileIds, setFollowingProfileIds] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [participantsError, setParticipantsError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [applyingForMembership, setApplyingForMembership] = useState(false);
  const [membershipMessage, setMembershipMessage] = useState('');
  const [followingClub, setFollowingClub] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState('');
  const [revision, setRevision] = useState(0);
  const loadMoreParticipants = useRef<() => void>(() => {});
  const markUnavailable = useCallback(() => setUnavailable(true), []);
  useEffect(() => {
    let active = true;
    fetchCurrentUserInfo(result => {
      if (!active) return;
      setCurrentUserId(result.currentUserId);
      if (!result.currentUserId) {
        setOwnedClubProfiles([]);
        setOwnedUserProfile(null);
        setFollowingProfileIds(new Set());
        return;
      }
      fetchClubProfiles(result.currentUserId, {
        onSuccess: profiles => {
          if (active) setOwnedClubProfiles(Array.isArray(profiles) ? profiles : []);
        },
        onError: () => {
          if (active) setOwnedClubProfiles([]);
        },
      });
      fetchOwnerUserProfile(result.currentUserId, {
        onSuccess: profile => { if (active) setOwnedUserProfile(profile); },
        onMissing: () => { if (active) setOwnedUserProfile(null); },
        onError: () => { if (active) setOwnedUserProfile(null); },
      });
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    const profiles = [ownedUserProfile, ...ownedClubProfiles].filter((profile): profile is Profile => profile !== null);
    if (!currentUserId || profiles.length === 0) {
      setFollowingProfileIds(new Set());
      return () => { active = false; };
    }
    Promise.all(profiles.map(async profile => [String(profile.id), await getClubFollowState(id, profile.id)] as const))
      .then(states => {
        if (!active) return;
        setFollowingProfileIds(new Set(states.filter(([, following]) => following).map(([profileId]) => profileId)));
      })
      .catch(error => {
        if (!active) return;
        if (isClubServiceUnavailable(error)) markUnavailable();
        else setFollowError((error as Error).message);
      });
    return () => { active = false; };
  }, [currentUserId, id, ownedClubProfiles, ownedUserProfile, markUnavailable]);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setUnavailable(false);
    getClub(id).then(data => { if (active) setClub(data); })
      .catch(e => {
        if (active) {
          if (isClubServiceUnavailable(e)) setUnavailable(true);
          else setError(e.message);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, revision]);
  useEffect(() => {
    let active = true, fetching = false, more = true, failed = false;
    let nextToken: string | undefined;
    setMembers([]); setHasMore(false); setParticipantsError(''); setParticipantsLoading(true);
    const fetchNext = async (retry = false) => {
      if (!active || fetching || !more || (failed && !retry)) return;
      fetching = true; failed = false; setParticipantsLoading(true); setParticipantsError('');
      try {
        const profiles = await getParticipants(id, nextToken);
        if (!active) return;
        setMembers(current => {
          const ids = new Set(current.map(profile => String(profile.id)));
          return [...current, ...profiles.content.filter(profile => !ids.has(String(profile.id)))];
        });
        nextToken = profiles.nextToken; more = profiles.hasMore; setHasMore(more);
      } catch (e) {
        failed = true;
        if (active) {
          if (isClubServiceUnavailable(e)) setUnavailable(true);
          else setParticipantsError((e as Error).message);
        }
      } finally {
        fetching = false;
        if (active) setParticipantsLoading(false);
      }
    };
    loadMoreParticipants.current = () => fetchNext(true);
    fetchNext();
    return () => { active = false; };
  }, [id, revision]);
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await action(); setRevision(value => value + 1); }
    catch (e) {
      if (isClubServiceUnavailable(e)) setUnavailable(true);
      else setError((e as Error).message);
    }
    finally { setBusy(false); }
  };
  const save = (draft: ClubDraft) => act(async () => { await updateClub(id, draft); setEditing(false); });
  const applyForMembership = async (profile: Profile) => {
    setBusy(true); setMembershipMessage(''); setError('');
    try {
      await requestJoin(id, profile.id);
      setMembershipMessage(t('membershipRequested', 'Membership application sent.'));
    } catch (e) {
      if (isClubServiceUnavailable(e)) setUnavailable(true);
      else setError((e as Error).message);
    } finally { setBusy(false); }
  };
  const toggleClubFollow = async (profile: Profile) => {
    const profileId = String(profile.id);
    const wasFollowing = followingProfileIds.has(profileId);
    setFollowBusy(true); setFollowError('');
    try {
      if (wasFollowing) await unfollowClub(id, profile.id);
      else await followClub(id, profile.id);
      setFollowingProfileIds(current => {
        const next = new Set(current);
        if (wasFollowing) next.delete(profileId);
        else next.add(profileId);
        return next;
      });
      setRevision(value => value + 1);
    } catch (error) {
      if (isClubServiceUnavailable(error)) markUnavailable();
      else setFollowError((error as Error).message || t('followFailed', 'Unable to update club follow state right now.'));
    } finally { setFollowBusy(false); }
  };
  const ownedProfiles = [ownedUserProfile, ...ownedClubProfiles].filter((profile): profile is Profile => profile !== null);
  const handleParticipantScroll: React.UIEventHandler<HTMLDivElement> = event => {
    const element = event.currentTarget;
    if (hasMore && !participantsLoading && element.scrollTop + element.clientHeight >= element.scrollHeight - 80) {
      loadMoreParticipants.current();
    }
  };
  return <Container className={`clubs-page${unavailable ? ' club-service-unavailable' : ''}`} aria-disabled={unavailable || undefined}>
    <Link to="/clubs">{t('back', 'All clubs')}</Link>
    {error && <Alert variant="danger" className="mt-3">{error} <Button variant="link" onClick={() => setRevision(value => value + 1)}>{t('retry', 'Retry')}</Button></Alert>}
    {loading ? <Spinner /> : club && <>
      <div className="club-page-heading mt-3"><div><h1>{club.name}</h1><PeriodBadge period={club.period} /></div>
        <div className="d-flex gap-2">
          {!editing && <Button
            variant="outline-dark"
            disabled={unavailable || currentUserId == null}
            title={currentUserId == null ? t('signInToApply', 'Sign in to apply for membership') : undefined}
            onClick={() => { setMembershipMessage(''); setApplyingForMembership(true); }}
          >{t('applyForMembership', 'Apply for membership')}</Button>}
          {!editing && <Button
            variant={followingProfileIds.size > 0 ? 'danger' : 'outline-dark'}
            disabled={unavailable || currentUserId == null}
            title={currentUserId == null ? t('signInToFollow', 'Sign in to follow this club') : undefined}
            onClick={() => { setFollowError(''); setFollowingClub(true); }}
          >{followingProfileIds.size > 0 ? t('following', 'Following') : t('follow', 'Follow')}</Button>}
          {club.canManage && !editing && <Button variant="outline-secondary" disabled={unavailable} onClick={() => setEditing(true)}>{t('edit', 'Edit club')}</Button>}
        </div>
      </div>
      <Row><Col lg={8}>
        <ClubPhotoPanel club={club} onChange={setClub} onUnavailable={markUnavailable} />
        <section className="club-panel">
          {editing ? <ClubForm initial={club} busy={busy || unavailable} onSave={save} onCancel={() => setEditing(false)} /> : <>
            <h2>{t('about', 'About the club')}</h2>
            <p className="club-description">{club.description || t('noDescription', 'No description yet.')}</p>
            {club.location && <p><strong>{t('location', 'Location')}: </strong>{club.location}</p>}
            {club.contactEmail && <p><strong>{t('email', 'Contact email')}: </strong><a href={`mailto:${club.contactEmail}`}>{club.contactEmail}</a></p>}
          </>}
        </section>
        <section className="club-panel">
          <h2>{t('members', 'Members')}</h2>
          {participantsError && <Alert variant="danger">{participantsError} <Button variant="link" onClick={() => setRevision(value => value + 1)}>{t('retry', 'Retry')}</Button></Alert>}
          <p className="text-muted">{t('membersHint', 'Members are club profiles. You can leave beside a profile you own.')}</p>
          {!participantsLoading && !participantsError && members.length === 0 && <p>{t('noMembers', 'No members yet.')}</p>}
          <div className="club-scroll-list" role="region" aria-label={t('members', 'Members')} onScroll={handleParticipantScroll}>
            <ul className="club-member-list">{members.map(profile => {
              const owned = currentUserId != null && profile.userId != null && String(profile.userId) === String(currentUserId);
              return <li key={profile.id}>
                <span><Link to={`/profile/${profile.alias || profile.id}`}>{buildProfileLabel(profile)}</Link> <PeriodBadge period={profile.period} /></span>
                {owned ? <Button className="club-leave-button" size="sm" variant="outline-secondary" disabled={busy || unavailable} onClick={() => act(() => detachProfile(id, profile.id))}>
                  <LeaveIcon aria-hidden="true" /> <span>{t('leave', 'Leave club')}</span>
                </Button> : club.canManage && <Button size="sm" variant="outline-danger" disabled={busy || unavailable} onClick={() => act(() => detachProfile(id, profile.id))}>{t('remove', 'Remove')}</Button>}
              </li>;
            })}</ul>
            {participantsLoading && <p role="status" className="text-muted mb-2">{t('loadingParticipants', 'Loading participants…')}</p>}
          </div>
        </section>
        <ClubFollowersPanel clubId={id} revision={revision} onUnavailable={markUnavailable} />
        {club.canManage && <JoinRequestsPanel clubId={id} onDecision={() => setRevision(value => value + 1)} onUnavailable={markUnavailable} />}
      </Col><Col lg={4}>
        <section className="club-panel">
          <h2>{t('management', 'Club management')}</h2>
          <p>{t('creator', 'Creator')}: <Link to={`/profile/user/${club.creatorUserId}`}>{t('viewProfile', 'View profile')}</Link></p>
          <h3 className="h6">{t('admins', 'Admins')}</h3>
          {club.adminUserIds.length === 0 && <p>{t('noAdmins', 'No additional admins.')}</p>}
          <ul className="club-member-list">{club.adminUserIds.map(userId => <li key={userId}>
            <Link to={`/profile/user/${userId}`}>{t('viewProfile', 'View profile')} #{userId}</Link>
            {club.canManageAdmins && <Button size="sm" variant="outline-danger" disabled={busy || unavailable} onClick={() => act(() => removeAdmin(id, userId))}>{t('remove', 'Remove')}</Button>}
          </li>)}</ul>
          {club.canManageAdmins && <>
            <h3 className="h6">{t('assignAdmin', 'Assign an admin')}</h3>
            <p className="text-muted">{t('adminHint', 'Choose a user’s personal profile. Admins can edit the club and manage participants.')}</p>
            <ProfilePicker type="USER" busy={busy} onSelect={profile => { if (profile.userId) act(() => addAdmin(id, profile.userId!)); }} />
            <Button variant="outline-danger" className="mt-4" onClick={() => setDeleting(true)}>{t('delete', 'Delete club')}</Button>
          </>}
        </section>
      </Col></Row>
    </>}
    <Modal show={deleting} onHide={() => { if (!busy) setDeleting(false); }} centered>
      <Modal.Header closeButton><Modal.Title>{t('delete', 'Delete club')}</Modal.Title></Modal.Header>
      <Modal.Body>{t('deleteConfirm', 'Delete this club and detach all participants? Their profiles will be kept.')}</Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" disabled={busy} onClick={() => setDeleting(false)}>{t('cancel', 'Cancel')}</Button>
        <Button variant="danger" disabled={busy} onClick={() => { setDeleting(false); act(async () => { await deleteClub(id); navigate('/clubs'); }); }}>{t('delete', 'Delete club')}</Button>
      </Modal.Footer>
    </Modal>
    <Modal show={applyingForMembership} onHide={() => { if (!busy) setApplyingForMembership(false); }} centered>
      <Modal.Header closeButton><Modal.Title>{t('applyForMembership', 'Apply for membership')}</Modal.Title></Modal.Header>
      <Modal.Body>
        {membershipMessage && <Alert variant="success">{membershipMessage}</Alert>}
        <p className="text-muted">{t('chooseProfileToApply', 'Choose one of your club profiles to apply for membership.')}</p>
        {ownedClubProfiles.length === 0 && <p>{t('noClubProfilesToApply', 'Create a club profile before applying for membership.')}</p>}
        <div className="d-flex flex-column gap-2">
          {ownedClubProfiles.map(profile => <div key={profile.id} className="d-flex justify-content-between align-items-center gap-2">
            <span><Link to={`/profile/${profile.alias || profile.id}`}>{buildProfileLabel(profile)}</Link> <PeriodBadge period={profile.period} /></span>
            <Button size="sm" variant="dark" disabled={busy || unavailable || profile.period !== club?.period} onClick={() => void applyForMembership(profile)}>
              {profile.period !== club?.period ? t('periodDoesNotMatch', 'Period does not match') : t('apply', 'Apply')}
            </Button>
          </div>)}
        </div>
      </Modal.Body>
      <Modal.Footer><Button variant="outline-secondary" disabled={busy} onClick={() => setApplyingForMembership(false)}>{t('close', 'Close')}</Button></Modal.Footer>
    </Modal>
    <ClubFollowModal
      show={followingClub}
      profiles={ownedProfiles}
      followingProfileIds={followingProfileIds}
      busy={followBusy || unavailable}
      error={followError}
      onHide={() => setFollowingClub(false)}
      onToggle={profile => { void toggleClubFollow(profile); }}
    />
  </Container>;
}
