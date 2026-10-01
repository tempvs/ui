import React, { useEffect, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { Link, useNavigate, useParams } from 'react-router-dom';

import Spinner from '../component/Spinner';
import ConfirmationModal from '../component/ConfirmationModal';
import ClubEventRequestsPanel from '../event/ClubEventRequestsPanel';
import { fetchCurrentUserInfo, fetchOwnerUserProfile } from '../profile/profileApi';
import { Profile } from '../profile/profileTypes';
import ProfileList from '../profile/components/ProfileList';
import { Club, addAdmin, deleteClub, getClub, isClubServiceUnavailable, removeAdmin } from './clubApi';
import JoinRequestsPanel from './JoinRequestsPanel';
import ProfilePicker from './ProfilePicker';
import './clubs.css';

export default function ClubAdminPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const intl = useIntl();
  const t = (key: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${key}`, defaultMessage });
  const [club, setClub] = useState<Club | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingAdmin, setRemovingAdmin] = useState<string | null>(null);
  const [adminProfiles, setAdminProfiles] = useState<Profile[]>([]);
  const [reviewerProfile, setReviewerProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    fetchCurrentUserInfo(result => {
      if (!active) return;
      setCurrentUserId(result.currentUserId);
      if (result.currentUserId == null) return;
      fetchOwnerUserProfile(result.currentUserId, {
        onSuccess: profile => { if (active) setReviewerProfile(profile); },
        onMissing: () => { if (active) setReviewerProfile(null); },
        onError: () => { if (active) setReviewerProfile(null); },
      });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setUnavailable(false);
    getClub(id)
      .then(data => {
        if (!active) return;
        setClub(data);
        const canonicalPath = `/clubs/${data.alias || data.id}/admin`;
        if (window.location.pathname !== canonicalPath) navigate(canonicalPath, { replace: true });
      })
      .catch(caught => {
        if (!active) return;
        if (isClubServiceUnavailable(caught)) setUnavailable(true);
        else setError((caught as Error).message || 'Unable to load club administration right now.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, navigate]);

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

  const viewerUserId = currentUserId == null ? null : String(currentUserId);
  const canManage = club != null && (club.canManage
    || (viewerUserId != null && (club.creatorUserId === viewerUserId || club.adminUserIds.includes(viewerUserId))));
  const clubPath = club ? `/clubs/${club.alias || club.id}` : `/clubs/${id}`;
  const canManageAdmins = club != null && (club.canManageAdmins
    || (viewerUserId != null && club.creatorUserId === viewerUserId));
  const act = async (action: () => Promise<Club | void>) => {
    setBusy(true); setError('');
    try {
      const saved = await action();
      if (saved) setClub(saved);
    } catch (caught) {
      setError((caught as Error).message || 'Unable to complete this administration action right now.');
    } finally { setBusy(false); }
  };

  return <Container className={`clubs-page${unavailable ? ' club-service-unavailable' : ''}`} aria-disabled={unavailable || undefined}>
    <Link to={clubPath}>{t('backToClub', 'Back to club')}</Link>
    {loading ? <Spinner /> : error ? <Alert variant="danger" className="mt-3">{error}</Alert> : !club ? null : !canManage ? (
      <Alert variant="danger" className="mt-3">{t('adminOnly', 'Club administration is available only to club admins.')}</Alert>
    ) : <>
      <div className="club-page-heading mt-3"><h1>{t('adminActions', 'Admin actions')}</h1>
        <Link className="btn btn-outline-dark" to={clubPath}>{t('viewClub', 'View club')}</Link>
      </div>
      <p className="text-muted">{t('adminActionsHint', 'Review membership applications and manage other club administration tasks here.')}</p>
      <JoinRequestsPanel clubId={club.id} onDecision={() => {}} />
      <ClubEventRequestsPanel clubId={club.id} reviewerProfileId={reviewerProfile ? String(reviewerProfile.id) : undefined} />
      {canManageAdmins && <section className="club-panel">
        <h2>{t('adminManagement', 'Administrators')}</h2>
        {club.adminUserIds.length === 0 && <p>{t('noAdmins', 'No additional admins.')}</p>}
        <ProfileList
          profiles={adminProfiles}
          className="club-member-list"
          renderActions={profile => profile.userId != null ? <Button size="sm" variant="outline-danger" disabled={busy} onClick={() => setRemovingAdmin(String(profile.userId))}>{t('remove', 'Remove')}</Button> : null}
        />
        {club.adminUserIds.length > adminProfiles.length && <ul className="club-member-list">{club.adminUserIds.filter(userId => !adminProfiles.some(profile => String(profile.userId) === String(userId))).map(userId => <li key={userId}>
          <Link to={`/profile/user/${userId}`}>{t('viewProfile', 'View profile')} #{userId}</Link>
          <Button size="sm" variant="outline-danger" disabled={busy} onClick={() => setRemovingAdmin(userId)}>{t('remove', 'Remove')}</Button>
        </li>)}</ul>}
        <h3 className="h6 mt-4">{t('assignAdmin', 'Assign an admin')}</h3>
        <p className="text-muted">{t('adminHint', 'Choose a club profile from this period. Its owner becomes a club administrator.')}</p>
        <ProfilePicker type="CLUB" period={club.period} busy={busy} onSelect={profile => { if (profile.userId) void act(() => addAdmin(club.id, profile.userId!)); }} />
        <Button variant="outline-danger" className="mt-4" disabled={busy} onClick={() => setDeleting(true)}>{t('delete', 'Delete club')}</Button>
      </section>}
    </>}
    <ConfirmationModal
      show={removingAdmin != null}
      title={t('removeAdmin', 'Remove administrator')}
      message={t('removeAdminConfirm', 'Remove this administrator from the club?')}
      confirmLabel={t('remove', 'Remove')}
      cancelLabel={t('cancel', 'Cancel')}
      busy={busy}
      onHide={() => { if (!busy) setRemovingAdmin(null); }}
      onConfirm={() => {
        if (!club || !removingAdmin) return;
        const userId = removingAdmin;
        setRemovingAdmin(null);
        void act(() => removeAdmin(club.id, userId));
      }}
    />
    <ConfirmationModal
      show={deleting}
      title={t('delete', 'Delete club')}
      message={t('deleteConfirm', 'Delete this club and detach all participants? Their profiles will be kept.')}
      confirmLabel={t('delete', 'Delete club')}
      cancelLabel={t('cancel', 'Cancel')}
      busy={busy}
      onHide={() => { if (!busy) setDeleting(false); }}
      onConfirm={() => {
        if (!club) return;
        setDeleting(false);
        void act(async () => { await deleteClub(club.id); navigate('/clubs'); });
      }}
    />
  </Container>;
}
