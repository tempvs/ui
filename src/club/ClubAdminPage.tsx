import React, { useEffect, useState } from 'react';
import { Alert, Container } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { Link, useNavigate, useParams } from 'react-router-dom';

import Spinner from '../component/Spinner';
import { fetchCurrentUserInfo } from '../profile/profileApi';
import { Club, getClub, isClubServiceUnavailable } from './clubApi';
import JoinRequestsPanel from './JoinRequestsPanel';
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

  useEffect(() => {
    let active = true;
    fetchCurrentUserInfo(result => { if (active) setCurrentUserId(result.currentUserId); });
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

  const viewerUserId = currentUserId == null ? null : String(currentUserId);
  const canManage = club != null && (club.canManage
    || (viewerUserId != null && (club.creatorUserId === viewerUserId || club.adminUserIds.includes(viewerUserId))));
  const clubPath = club ? `/clubs/${club.alias || club.id}` : `/clubs/${id}`;

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
    </>}
  </Container>;
}
