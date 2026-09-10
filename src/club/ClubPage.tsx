import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Col, Container, Modal, Row } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { FaSignOutAlt } from 'react-icons/fa';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Spinner from '../component/Spinner';
import { fetchCurrentUserInfo } from '../profile/profileApi';
import { Profile } from '../profile/profileTypes';
import { buildProfileLabel } from '../profile/currentProfile';
import { PeriodBadge } from '../util/periods';
import { Club, ClubDraft, addAdmin, deleteClub, detachProfile, getClub, getParticipants, isClubServiceUnavailable, removeAdmin, updateClub } from './clubApi';
import ClubForm from './ClubForm';
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
  const [revision, setRevision] = useState(0);
  const loadMoreParticipants = useRef<() => void>(() => {});
  const markUnavailable = useCallback(() => setUnavailable(true), []);
  useEffect(() => {
    let active = true;
    fetchCurrentUserInfo(result => { if (active) setCurrentUserId(result.currentUserId); });
    return () => { active = false; };
  }, []);
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
    let nextPage = 0;
    setMembers([]); setHasMore(false); setParticipantsError(''); setParticipantsLoading(true);
    const fetchNext = async (retry = false) => {
      if (!active || fetching || !more || (failed && !retry)) return;
      fetching = true; failed = false; setParticipantsLoading(true); setParticipantsError('');
      try {
        const profiles = await getParticipants(id, nextPage);
        if (!active) return;
        setMembers(current => {
          const ids = new Set(current.map(profile => String(profile.id)));
          return [...current, ...profiles.content.filter(profile => !ids.has(String(profile.id)))];
        });
        nextPage += 1; more = profiles.hasMore; setHasMore(more);
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
        {club.canManage && !editing && <Button variant="outline-secondary" disabled={unavailable} onClick={() => setEditing(true)}>{t('edit', 'Edit club')}</Button>}
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
          <h2>{t('participants', 'Participants')}</h2>
          {participantsError && <Alert variant="danger">{participantsError} <Button variant="link" onClick={() => setRevision(value => value + 1)}>{t('retry', 'Retry')}</Button></Alert>}
          <p className="text-muted">{t('participantsHint', 'Participants are club profiles. You can leave beside a profile you own.')}</p>
          {!participantsLoading && !participantsError && members.length === 0 && <p>{t('noParticipants', 'No participants yet.')}</p>}
          <div className="club-scroll-list" role="region" aria-label={t('participants', 'Participants')} onScroll={handleParticipantScroll}>
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
  </Container>;
}
