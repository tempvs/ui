import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Col, Container, Modal, Row } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { FaSignOutAlt, FaUserMinus } from 'react-icons/fa';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ConfirmationModal from '../component/ConfirmationModal';
import { SaveStatus } from '../component/EditableFieldRow';
import TextFilterInput from '../component/TextFilterInput';
import Spinner from '../component/Spinner';
import { fetchClubProfiles, fetchCurrentUserInfo, fetchOwnerUserProfile } from '../profile/profileApi';
import { Profile } from '../profile/profileTypes';
import ProfileList from '../profile/components/ProfileList';
import { buildProfileLabel } from '../profile/currentProfile';
import { PeriodBadge } from '../util/periods';
import { Club, ClubDraft, detachProfile, followClub, getClub, getClubFollowState, getParticipants, isClubServiceUnavailable, requestJoin, unfollowClub, updateClub } from './clubApi';
import ClubFollowModal from './ClubFollowModal';
import ClubFollowersPanel from './ClubFollowersPanel';
import ClubFieldsPanel, { ClubField } from './ClubFieldsPanel';
import ClubPhotoPanel from './ClubPhotoPanel';
import PostPanel from '../post/PostPanel';
import './clubs.css';

const LeaveIcon = FaSignOutAlt as React.ComponentType<{ 'aria-hidden'?: string }>;
const RemoveMemberIcon = FaUserMinus as React.ComponentType<{ 'aria-hidden'?: string }>;
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
    alias: club.alias,
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
  const [adminProfiles, setAdminProfiles] = useState<Profile[]>([]);
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
  const [memberRemoval, setMemberRemoval] = useState<{ profile: Profile; leave: boolean } | null>(null);
  const [applyingForMembership, setApplyingForMembership] = useState(false);
  const [membershipMessage, setMembershipMessage] = useState('');
  const [followingClub, setFollowingClub] = useState(false);
  const [unfollowTarget, setUnfollowTarget] = useState<Profile | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState('');
  const [revision, setRevision] = useState(0);
  const [followersRevision, setFollowersRevision] = useState(0);
  const [memberFilter, setMemberFilter] = useState('');
  const loadedClubId = club?.id;
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
    if (!currentUserId || profiles.length === 0 || !loadedClubId) {
      setFollowingProfileIds(new Set());
      return () => { active = false; };
    }
    const loadFollowStates = async () => {
      const states: Array<readonly [string, boolean]> = [];
      // These are optional display-state reads. Running them sequentially
      // avoids a burst of Lambda invocations when a user owns several Club
      // profiles, while the retry handles a transient cold-start throttle.
      for (const profile of profiles) {
        states.push([String(profile.id), await getClubFollowStateWithRetry(String(loadedClubId), profile.id)] as const);
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
  }, [currentUserId, loadedClubId, ownedClubProfiles, ownedUserProfile]);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setUnavailable(false);
    getClub(id).then(data => {
      if (!active) return;
      draftRef.current = clubDraft(data);
      setClub(data);
      setFieldStatuses({});
      const canonicalPath = `/clubs/${data.alias || data.id}`;
      if (window.location.pathname !== canonicalPath) navigate(canonicalPath, { replace: true });
    })
      .catch(e => {
        if (active) {
          if (isClubServiceUnavailable(e)) setUnavailable(true);
          else setError(e.message);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, navigate, revision]);
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
    const adminUserIds = club?.adminUserIds ?? [];
    let active = true;
    if (adminUserIds.length === 0) {
      setAdminProfiles([]);
      return () => { active = false; };
    }
    const profiles: Profile[] = [];
    let remaining = adminUserIds.length;
    const done = () => {
      remaining -= 1;
      if (active && remaining === 0) setAdminProfiles(profiles);
    };
    adminUserIds.forEach(userId => fetchOwnerUserProfile(userId, {
      onSuccess: profile => { if (profile) profiles.push(profile); done(); },
      onMissing: done,
      onError: done,
    }));
    return () => { active = false; };
  }, [club?.adminUserIds]);
  useEffect(() => {
    // Load the primary Club record before secondary panels. On a constrained
    // account this prevents the initial page render from fanning out into a
    // burst of authorizer/read Lambdas.
    if (!loadedClubId) return undefined;
    let active = true, fetching = false, more = true, failed = false;
    let nextToken: string | undefined;
    setMembers([]); setHasMore(false); setParticipantsError(''); setParticipantsLoading(true);
    const fetchNext = async (retry = false) => {
      if (!active || fetching || !more || (failed && !retry)) return;
      fetching = true; failed = false; setParticipantsLoading(true); setParticipantsError('');
      try {
        const profiles = await getParticipants(loadedClubId, nextToken);
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
  }, [revision, loadedClubId]);
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
    if (!draft || !canManage) return;
    setFieldStatuses(current => ({ ...current, [field]: 'saving' }));
    try {
      const saved = await updateClub(club!.id, draft);
      draftRef.current = clubDraft(saved);
      setClub(saved);
      const canonicalPath = `/clubs/${saved.alias || saved.id}`;
      if (window.location.pathname !== canonicalPath) navigate(canonicalPath, { replace: true });
      setFieldStatuses(current => ({ ...current, [field]: 'success' }));
    } catch (caught) {
      setFieldStatuses(current => ({ ...current, [field]: 'error' }));
    }
  };
  const applyForMembership = async (profile: Profile) => {
    setBusy(true); setMembershipMessage(''); setError('');
    try {
      await requestJoin(club!.id, profile.id);
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
      if (wasFollowing) await unfollowClub(club!.id, profile.id);
      else await followClub(club!.id, profile.id);
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
  const visibleMembers = useMemo(() => {
    const query = memberFilter.trim().toLocaleLowerCase();
    if (!query) return members;
    return members.filter(profile => buildProfileLabel(profile).toLocaleLowerCase().includes(query));
  }, [memberFilter, members]);
  const handleParticipantScroll: React.UIEventHandler<HTMLDivElement> = event => {
    const element = event.currentTarget;
    if (hasMore && !participantsLoading && element.scrollTop + element.clientHeight >= element.scrollHeight - 80) {
      loadMoreParticipants.current();
    }
  };
  const viewerUserId = currentUserId == null ? null : String(currentUserId);
  // The API remains the authority for mutations. This client-side fallback
  // keeps the management controls available when a cached/public club read
  // has not carried the authenticated viewer context yet.
  const canManage = club != null && (
    club.canManage
    || (viewerUserId != null && (club.creatorUserId === viewerUserId || club.adminUserIds.includes(viewerUserId)))
  );
  const managedClub = club && canManage && !club.canManage
    ? { ...club, canManage: true }
    : club;
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
          {canManage && <Link className="btn btn-outline-dark" to={`/clubs/${club.alias || club.id}/admin`}>
            {t('adminActions', 'Admin actions')}
          </Link>}
        </div>
      </div>
      <Row className="club-page-columns"><Col lg={3}>
        <ClubPhotoPanel club={managedClub ?? club} onChange={setClub} />
        <section className="club-panel">
          <h3 className="h6">{t('owner', 'Owner')}</h3>
          {ownerProfile ? <ProfileList profiles={[ownerProfile]} className="club-member-list mb-3" /> : <p>{t('ownerUnavailable', 'Owner profile unavailable.')}</p>}
          {club.adminUserIds.length > 0 && <>
            <h3 className="h6">{t('admins', 'Admins')}</h3>
            {adminProfiles.length > 0 && <ProfileList profiles={adminProfiles} className="club-member-list" />}
            {club.adminUserIds.length > adminProfiles.length && <ul className="club-member-list">{club.adminUserIds.filter(userId => !adminProfiles.some(profile => String(profile.userId) === String(userId))).map(userId => <li key={userId}>
              <Link to={`/profile/user/${userId}`}>{t('viewProfile', 'View profile')} #{userId}</Link>
            </li>)}</ul>}
          </>}
        </section>
      </Col><Col lg={6}>
        <ClubFieldsPanel club={club} editable={canManage && !unavailable} statuses={fieldStatuses} onChange={changeClubField} onBlur={saveClubField} />
        <PostPanel targetType="CLUB" targetId={club.id} canCreate={canManage && !unavailable} />
      </Col><Col lg={3}>
        <section className="club-panel">
          <div className="club-list-heading">
            <h2>{t('members', 'Members')}</h2>
            <TextFilterInput
              value={memberFilter}
              onChange={setMemberFilter}
              placeholder={t('filterMembers', 'Filter members')}
              ariaLabel={t('filterMembers', 'Filter members')}
              className="club-list-filter"
            />
          </div>
          {participantsError && <Alert variant="danger">{participantsError} <Button variant="link" onClick={() => setRevision(value => value + 1)}>{t('retry', 'Retry')}</Button></Alert>}
          <p className="text-muted">{t('membersHint', 'Members are profiles linked to this club. You can leave beside a profile you own.')}</p>
          {!participantsLoading && !participantsError && members.length === 0 && <p>{t('noMembers', 'No members yet.')}</p>}
          {!participantsLoading && !participantsError && members.length > 0 && visibleMembers.length === 0 && <p>{t('noMatchingMembers', 'No members match this filter.')}</p>}
          <div className="club-scroll-list" role="region" aria-label={t('members', 'Members')} onScroll={handleParticipantScroll}>
            <ProfileList profiles={visibleMembers} className="club-member-list" renderActions={profile => {
              const owned = currentUserId != null && profile.userId != null && String(profile.userId) === String(currentUserId);
              return owned ? <Button className="club-icon-action" size="sm" variant="outline-secondary" title={t('leave', 'Leave club')} aria-label={t('leave', 'Leave club')} disabled={busy || unavailable} onClick={() => setMemberRemoval({ profile, leave: true })}>
                  <LeaveIcon aria-hidden="true" />
                </Button> : canManage ? <Button size="sm" variant="outline-danger" className="club-icon-action" title={t('removeMember', 'Remove member')} aria-label={t('removeMember', 'Remove member')} disabled={busy || unavailable} onClick={() => setMemberRemoval({ profile, leave: false })}>
                  <RemoveMemberIcon aria-hidden="true" />
                </Button> : null;
            }} />
            {participantsLoading && <p role="status" className="text-muted mb-2">{t('loadingParticipants', 'Loading participants…')}</p>}
          </div>
        </section>
        <ClubFollowersPanel
          clubId={String(club.id)}
          revision={followersRevision}
          canManage={canManage}
          onRemove={async profile => {
            await unfollowClub(club.id, profile.id);
            setFollowingProfileIds(current => {
              const next = new Set(current);
              next.delete(String(profile.id));
              return next;
            });
          }}
        />
      </Col></Row>
    </>}
    <ConfirmationModal
      show={memberRemoval != null}
      title={memberRemoval?.leave ? t('leave', 'Leave club') : t('removeMember', 'Remove member')}
      message={memberRemoval?.leave
        ? t('leaveConfirm', 'Are you sure you want to leave this club?')
        : <>Remove <strong>{memberRemoval ? buildProfileLabel(memberRemoval.profile) : ''}</strong> from this club?</>}
      confirmLabel={memberRemoval?.leave ? t('leave', 'Leave club') : t('remove', 'Remove')}
      cancelLabel={t('cancel', 'Cancel')}
      busy={busy}
      onHide={() => { if (!busy) setMemberRemoval(null); }}
      onConfirm={() => {
        if (!memberRemoval) return;
        const profile = memberRemoval.profile;
        setMemberRemoval(null);
        void act(() => detachProfile(club?.id ?? id, profile.id));
      }}
    />
    <ConfirmationModal
      show={unfollowTarget != null}
      title={t('unfollow', 'Unfollow club')}
      message={t('unfollowClubConfirm', 'Are you sure you want to unfollow this club?')}
      confirmLabel={t('unfollow', 'Unfollow')}
      cancelLabel={t('cancel', 'Cancel')}
      busy={followBusy}
      onHide={() => { if (!followBusy) setUnfollowTarget(null); }}
      onConfirm={() => {
        if (!unfollowTarget) return;
        const profile = unfollowTarget;
        setUnfollowTarget(null);
        void toggleClubFollow(profile);
      }}
    />
    <Modal show={applyingForMembership} onHide={() => { if (!busy) setApplyingForMembership(false); }} centered>
      <Modal.Header closeButton><Modal.Title>{t('applyForMembership', 'Apply for membership')}</Modal.Title></Modal.Header>
      <Modal.Body>
        {membershipMessage && <Alert variant="success">{membershipMessage}</Alert>}
        <p className="text-muted">{t('chooseProfileToApply', 'Choose one of your club profiles to apply for membership.')}</p>
        {ownedClubProfiles.length === 0 && <p>{t('noClubProfilesToApply', 'Create a club profile before applying for membership.')}</p>}
        <ProfileList profiles={ownedClubProfiles} showPeriod className="club-member-list mb-0" renderActions={profile =>
          <Button size="sm" variant="dark" disabled={busy || unavailable || profile.period !== club?.period} onClick={() => void applyForMembership(profile)}>
              {profile.period !== club?.period ? t('periodDoesNotMatch', 'Period does not match') : t('apply', 'Apply')}
          </Button>
        } />
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
      onToggle={profile => {
        if (followingProfileIds.has(String(profile.id))) setUnfollowTarget(profile);
        else void toggleClubFollow(profile);
      }}
    />
  </Container>;
}
