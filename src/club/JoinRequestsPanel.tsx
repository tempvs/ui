import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { Id } from '../profile/profileTypes';
import { buildProfileLabel } from '../profile/currentProfile';
import { decideJoinRequest, getJoinRequests, isClubServiceUnavailable, JoinRequest } from './clubApi';

export default function JoinRequestsPanel({ clubId, onDecision, onUnavailable }: {
  clubId: Id; onDecision: () => void; onUnavailable?: () => void;
}) {
  const intl = useIntl();
  const t = (key: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${key}`, defaultMessage });
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loadMore = useRef<() => void>(() => {});

  useEffect(() => {
    let active = true, fetching = false, more = true, failed = false;
    let nextPage = 0;
    setRequests([]); setLoading(true); setHasMore(false); setError('');
    const fetchNext = async (retry = false) => {
      if (!active || fetching || !more || (failed && !retry)) return;
      fetching = true; failed = false; setLoading(true); setError('');
      try {
        const data = await getJoinRequests(clubId, nextPage);
        if (!active) return;
        setRequests(current => {
          const ids = new Set(current.map(request => request.id));
          return [...current, ...data.filter(request => !ids.has(request.id))];
        });
        nextPage += 1; more = data.length === 20; setHasMore(more);
      } catch (e) {
        failed = true;
        if (active) {
          if (isClubServiceUnavailable(e)) onUnavailable?.();
          else setError((e as Error).message);
        }
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };
    loadMore.current = () => fetchNext(true);
    fetchNext();
    return () => { active = false; };
  }, [clubId, revision, onUnavailable]);

  const decide = async (request: JoinRequest, decision: 'accept' | 'reject') => {
    setBusy(true); setError('');
    try { await decideJoinRequest(clubId, request.id, decision); onDecision(); setRevision(value => value + 1); }
    catch (e) {
      if (isClubServiceUnavailable(e)) onUnavailable?.();
      else setError((e as Error).message);
    }
    finally { setBusy(false); }
  };

  return <section className="club-panel">
    <div className="club-page-heading"><h2>{t('joinRequests', 'Join requests')}</h2>
      <Button size="sm" variant="outline-secondary" disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>{t('refresh', 'Refresh')}</Button>
    </div>
    {error && <Alert variant="danger">{error} <Button variant="link" onClick={() => loadMore.current()}>{t('retry', 'Retry')}</Button></Alert>}
    {!loading && !error && requests.length === 0 && <p>{t('noRequests', 'No pending join requests.')}</p>}
    {requests.length > 0 && <div className="club-scroll-list" role="region" aria-label={t('joinRequests', 'Join requests')} onScroll={event => {
      const element = event.currentTarget;
      if (hasMore && !loading && element.scrollTop + element.clientHeight >= element.scrollHeight - 80) loadMore.current();
    }}>
      <ul className="club-member-list">{requests.map(request => <li key={request.id}>
        {request.profile ? <Link to={`/profile/${request.profile.alias || request.profileId}`}>{buildProfileLabel(request.profile)}</Link> : <span>{t('unavailableProfile', 'Profile no longer available')}</span>}
        <div className="club-actions">
          <Button size="sm" variant="outline-success" disabled={busy || !request.profile} onClick={() => decide(request, 'accept')}>{t('accept', 'Accept')}</Button>
          <Button size="sm" variant="outline-danger" disabled={busy} onClick={() => decide(request, 'reject')}>{t('reject', 'Reject')}</Button>
        </div>
      </li>)}</ul>
    </div>}
    {loading && <p role="status">{t('loadingRequests', 'Loading requests…')}</p>}
  </section>;
}
