import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Col, Container, Modal, Row } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { FaSignOutAlt } from 'react-icons/fa';
import { Link, useNavigate, useParams } from 'react-router-dom';
import defaultImage from '../assets/default-image.png';
import { SaveStatus } from '../component/EditableFieldRow';
import Spinner from '../component/Spinner';
import RefreshingImage from '../image/RefreshingImage';
import { fetchClubProfiles, fetchCurrentUserInfo, fetchOwnerUserProfile } from '../profile/profileApi';
import { Profile } from '../profile/profileTypes';
import { buildProfileLabel } from '../profile/currentProfile';
import { PeriodBadge } from '../util/periods';
import { Club, ClubDraft, addAdmin, deleteClub, detachProfile, followClub, getClub, getClubFollowState, getParticipants, isClubServiceUnavailable, removeAdmin, requestJoin, unfollowClub, updateClub } from './clubApi';
import ClubFollowModal from './ClubFollowModal';
import ClubFollowersPanel from './ClubFollowersPanel';
import ClubFieldsPanel, { ClubField } from './ClubFieldsPanel';
import ProfilePicker from './ProfilePicker';
import JoinRequestsPanel from './JoinRequestsPanel';
import ClubPhotoPanel from './ClubPhotoPanel';
import './clubs.css';

const LeaveIcon = FaSignOutAlt as React.ComponentType<{ 'aria-hidden'?: string }>;
const FOLLOW_STATE_RETRY_DELAY_MS = 300;

function wait(delayMs: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, delayMs));
}

async function getClubFollowStateWithRetry(clubId: string, profileId: string | number) {
  try {
    return await getClubFollowState(clubId, profileId);
  } catch (error) {
    if (!isClubServiceUnavailable(error)) throw error;
    await wait(FOLLOW_STATE_RETRY_DELAY_MS);
    return getClubFollowState(clubId, profileId);
  }
}

function clubDraft(club: Club): ClubDraft {
  return {
    name: club.name,
    description: club.description,
    location: club.location,
    contactEmail: club.contactEmail,
    period: club.period,
  };
}

export default function ClubPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const intl = useIntl();
  const t = (key: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${key}`, defaultMessage });
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [ownedClubProfiles, setOwnedClubProfiles] = useState<Profile[]>([]);
  const [ownedUserProfile, setOwnedUserProfile] = useState<Profile | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [followingProfileIds, setFollowingProfileIds] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [participantsError, setParticipantsError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [fieldStatuses, setFieldStatuses] = useState<Partial<Record<ClubField, SaveStatus>>>({});
  const [deleting, setDeleting] = useState(false);
  const [applyingForMembership, setApplyingForMembership] = useState(false);
  const [membershipMessage, setMembershipMessage] = useState('');
  const [followingClub, setFollowingClub] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState('');
  const [revision, setRevision] = useState(0);
  const [followersRevision, setFollowersRevision] = useState(0);
  const draftRef = useRef<ClubDraft | null>(null);
  const loadMoreParticipants = useRef<() => void>(() => {});
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
    const loadFollowStates = async () => {
      const states: Array<readonly [string, boolean]> = [];
      // These are optional display-state reads. Running them sequentially
      // avoids a burst of Lambda invocations when a user owns several Club
      // profiles, while the retry handles a transient cold-start throttle.
      for (const profile of profiles) {
        states.push([String(profile.id), await getClubFollowStateWithRetry(id, profile.id)] as const);
      }
      return states;
    };
    void loadFollowStates()
      .then(states => {
        if (!active) return;
        setFollowingProfileIds(new Set(states.filter(([, following]) => following).map(([profileId]) => profileId)));
      })
      .catch(error => {
        if (!active) return;
        setFollowingProfileIds(new Set());
        setFollowError((error as Error).message || 'Unable to load club follow status right now.');
      });
    return () => { active = false; };
  }, [currentUserId, id, ownedClubProfiles, ownedUserProfile]);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setUnavailable(false);
    getClub(id).then(data => {
      if (!active) return;
      draftRef.current = clubDraft(data);
      setClub(data);
      setFieldStatuses({});
    })
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
    if (!club?.creatorUserId) {
      setOwnerProfile(null);
      return undefined;
    }
    let active = true;
    fetchOwnerUserProfile(club.creatorUserId, {
      onSuccess: profile => { if (active) setOwnerProfile(profile); },
      onMissing: () => { if (active) setOwnerProfile(null); },
      onError: () => { if (active) setOwnerProfile(null); },
    });
    return () => { active = false; };
  }, [club?.creatorUserId]);
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
          setParticipantsError((e as Error).message || 'Unable to load members right now.');
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
      setError((e as Error).message || t('actionFailed', 'The club request could not be completed.'));
    }
    finally { setBusy(false); }
  };
  const changeClubField = (field: ClubField, value: string) => {
    const current = draftRef.current || (club ? clubDraft(club) : null);
    if (!current) return;
    const next = { ...current, [field]: value } as ClubDraft;
    draftRef.current = next;
    setClub(existing => existing ? { ...existing, [field]: value || null } as Club : existing);
  };
  const saveClubField = async (field: ClubField) => {
    const draft = draftRef.current;
    if (!draft || !club?.canManage) return;
    setFieldStatuses(current => ({ ...current, [field]: 'saving' }));
    try {
      const saved = await updateClub(id, draft);
      draftRef.current = clubDraft(saved);
      setClub(saved);
      setFieldStatuses(current => ({ ...current, [field]: 'success' }));
    } catch (caught) {
      setFieldStatuses(current => ({ ...current, [field]: 'error' }));
    }
  };
  const applyForMembership = async (profile: Profile) => {
    setBusy(true); setMembershipMessage(''); setError('');
    try {
      await requestJoin(id, profile.id);
      setMembershipMessage(t('membershipRequested', 'Membership application sent.'));
    } catch (e) {
      setError((e as Error).message || t('membershipFailed', 'Unable to submit membership application right now.'));
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
      setFollowersRevision(value => value + 1);
    } catch (error) {
      setFollowError((error as Error).message || t('followFailed', 'Unable to update club follow state right now.'));
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
          <Button
            variant="outline-dark"
            disabled={unavailable || currentUserId == null}
            title={currentUserId == null ? t('signInToApply', 'Sign in to apply for membership') : undefined}
            onClick={() => { setMembershipMessage(''); setApplyingForMembership(true); }}
          >{t('applyForMembership', 'Apply for membership')}</Button>
          <Button
            variant={followingProfileIds.size > 0 ? 'danger' : 'outline-dark'}
            disabled={unavailable || currentUserId == null}
            title={currentUserId == null ? t('signInToFollow', 'Sign in to follow this club') : undefined}
            onClick={() => { setFollowError(''); setFollowingClub(true); }}
          >{followingProfileIds.size > 0 ? t('following', 'Following') : t('follow', 'Follow')}</Button>
        </div>
      </div>
      <Row><Col lg={8}>
        <ClubPhotoPanel club={club} onChange={setClub} />
        <ClubFieldsPanel club={club} editable={club.canManage && !unavailable} statuses={fieldStatuses} onChange={changeClubField} onBlur={saveClubField} />
        <section className="club-panel">
          <h2>{t('members', 'Members')}</h2>
          {participantsError && <Alert variant="danger">{participantsError} <Button variant="link" onClick={() => setRevision(value => value + 1)}>{t('retry', 'Retry')}</Button></Alert>}
          <p className="text-muted">{t('membersHint', 'Members are profiles linked to this club. You can leave beside a profile you own.')}</p>
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
        <ClubFollowersPanel clubId={id} revision={followersRevision} />
        {club.canManage && <JoinRequestsPanel clubId={id} onDecision={() => setRevision(value => value + 1)} />}
      </Col><Col lg={4}>
        <section className="club-panel">
          <h2>{t('management', 'Club administration')}</h2>
          <h3 className="h6">{t('owner', 'Owner')}</h3>
          {ownerProfile ? <div className="profile-following-list mb-3"><Link to={`/profile/${ownerProfile.alias || ownerProfile.id}`} className="profile-following-item">
            <span className="profile-following-thumb"><RefreshingImage image={{ resourceType: 'profile', resourceId: ownerProfile.id }} variant="thumbnail" fallbackSrc={defaultImage} className="profile-following-thumb-image" alt="" loading="lazy" /></span>
            <span className="profile-following-name">{buildProfileLabel(ownerProfile)}</span>
          </Link></div> : <p>{t('ownerUnavailable', 'Owner profile unavailable.')}</p>}
          <h3 className="h6">{t('admins', 'Admins')}</h3>
          {club.adminUserIds.length === 0 && <p>{t('noAdmins', 'No additional admins.')}</p>}
          <ul className="club-member-list">{club.adminUserIds.map(userId => <li key={userId}>
            <Link to={`/profile/user/${userId}`}>{t('viewProfile', 'View profile')} #{userId}</Link>
            {club.canManageAdmins && <Button size="sm" variant="outline-danger" disabled={busy || unavailable} onClick={() => act(() => removeAdmin(id, userId))}>{t('remove', 'Remove')}</Button>}
          </li>)}</ul>
          {club.canManageAdmins && <>
            <h3 className="h6">{t('assignAdmin', 'Assign an admin')}</h3>
            <p className="text-muted">{t('adminHint', 'Choose a club profile from this period. Its owner becomes a club administrator.')}</p>
            <ProfilePicker type="CLUB" period={club.period} busy={busy} onSelect={profile => { if (profile.userId) act(() => addAdmin(id, profile.userId!)); }} />
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
