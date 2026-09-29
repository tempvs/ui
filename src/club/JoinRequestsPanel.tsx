import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { Id } from '../profile/profileTypes';
import { buildProfileLabel } from '../profile/currentProfile';
import ProfileList from '../profile/components/ProfileList';
import TextFilterInput from '../component/TextFilterInput';
import { decideJoinRequest, getJoinRequests, JoinRequest } from './clubApi';

export default function JoinRequestsPanel({ clubId, onDecision }: {
  clubId: Id; onDecision: () => void;
}) {
  const intl = useIntl();
  const t = (key: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${key}`, defaultMessage });
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const loadMore = useRef<() => void>(() => {});

  useEffect(() => {
    let active = true, fetching = false, more = true, failed = false;
    let nextToken: string | undefined;
    setRequests([]); setLoading(true); setHasMore(false); setError('');
    const fetchNext = async (retry = false) => {
      if (!active || fetching || !more || (failed && !retry)) return;
      fetching = true; failed = false; setLoading(true); setError('');
      try {
        const data = await getJoinRequests(clubId, nextToken);
        if (!active) return;
        setRequests(current => {
          const ids = new Set(current.map(request => request.id));
          return [...current, ...data.content.filter(request => !ids.has(request.id))];
        });
        nextToken = data.nextToken; more = data.hasMore; setHasMore(more);
      } catch (e) {
        failed = true;
        if (active) {
          setError((e as Error).message || 'Unable to load join requests right now.');
        }
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };
    loadMore.current = () => fetchNext(true);
    fetchNext();
    return () => { active = false; };
  }, [clubId, revision]);

  const decide = async (request: JoinRequest, decision: 'accept' | 'reject') => {
    setBusy(true); setError('');
    try { await decideJoinRequest(clubId, request.id, decision); onDecision(); setRevision(value => value + 1); }
    catch (e) { setError((e as Error).message || t('joinDecisionFailed', 'Unable to update this join request right now.')); }
    finally { setBusy(false); }
  };

  const visibleRequests = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    if (!query) return requests;
    return requests.filter(request => request.profile != null && buildProfileLabel(request.profile).toLocaleLowerCase().includes(query));
  }, [filter, requests]);
  const visibleProfiles = visibleRequests.flatMap(request => request.profile ? [request.profile] : []);

  return <section className="club-panel">
    <div className="club-list-heading"><h2>{t('joinRequests', 'Join requests')}</h2>
      <div className="d-flex gap-2">
        <TextFilterInput value={filter} onChange={setFilter} placeholder={t('filterRequests', 'Filter requests')} ariaLabel={t('filterRequests', 'Filter requests')} className="club-list-filter" />
        <Button size="sm" variant="outline-secondary" disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>{t('refresh', 'Refresh')}</Button>
      </div>
    </div>
    {error && <Alert variant="danger">{error} <Button variant="link" onClick={() => loadMore.current()}>{t('retry', 'Retry')}</Button></Alert>}
    {!loading && !error && requests.length === 0 && <p>{t('noRequests', 'No pending join requests.')}</p>}
    {!loading && !error && requests.length > 0 && visibleRequests.length === 0 && <p>{t('noMatchingRequests', 'No requests match this filter.')}</p>}
    {requests.length > 0 && <div className="club-scroll-list" role="region" aria-label={t('joinRequests', 'Join requests')} onScroll={event => {
      const element = event.currentTarget;
      if (hasMore && !loading && element.scrollTop + element.clientHeight >= element.scrollHeight - 80) loadMore.current();
    }}>
      <ProfileList profiles={visibleProfiles} showPeriod className="club-member-list" renderActions={profile => {
        const request = visibleRequests.find(candidate => String(candidate.profile?.id) === String(profile.id));
        if (!request) return null;
        return <div className="club-actions">
          <Button size="sm" variant="outline-success" disabled={busy} onClick={() => decide(request, 'accept')}>{t('accept', 'Accept')}</Button>
          <Button size="sm" variant="outline-danger" disabled={busy} onClick={() => decide(request, 'reject')}>{t('reject', 'Reject')}</Button>
        </div>;
      }} />
      {visibleRequests.filter(request => !request.profile).map(request => <p key={request.id}>{t('unavailableProfile', 'Profile no longer available')}</p>)}
    </div>}
    {loading && <p role="status">{t('loadingRequests', 'Loading requests…')}</p>}
  </section>;
}
