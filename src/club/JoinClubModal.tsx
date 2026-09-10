import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { Id } from '../profile/profileTypes';
import { PeriodBadge } from '../util/periods';
import { getJoinOptions, JoinOption, requestJoin } from './clubApi';

export default function JoinClubModal({ profileId, period, onClose }: { profileId: Id; period?: string; onClose: () => void }) {
  const intl = useIntl();
  const t = (key: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${key}`, defaultMessage });
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<JoinOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const results = useRef<HTMLDivElement>(null);
  const loadMore = useRef<() => void>(() => {});

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let fetching = false;
    let nextPage = 0;
    let more = true;
    let ready = false;
    setOptions([]); setLoading(true); setHasMore(false); setSearchError('');
    if (results.current) results.current.scrollTop = 0;

    const fetchNext = async () => {
      if (!active || !ready || fetching || !more) return;
      fetching = true; setLoading(true); setSearchError('');
      try {
        const data = await getJoinOptions(profileId, query.trim(), nextPage, controller.signal);
        if (!active) return;
        setOptions(current => {
          const ids = new Set(current.map(option => option.club.id));
          return [...current, ...data.content.filter(option => !ids.has(option.club.id))];
        });
        nextPage += 1;
        more = data.hasMore;
        setHasMore(more);
      } catch (e) {
        if (active) setSearchError((e as Error).message);
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };
    loadMore.current = fetchNext;
    const timer = window.setTimeout(() => { ready = true; fetchNext(); }, 250);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [profileId, period, query]);

  // Fill a short viewport as well as loading when its scroll reaches the bottom.
  useEffect(() => {
    const element = results.current;
    if (!loading && hasMore && !searchError && element && element.clientHeight > 0 && element.scrollHeight <= element.clientHeight) {
      loadMore.current();
    }
  }, [loading, hasMore, searchError, options.length]);

  const send = async (clubId: Id) => {
    setBusy(true); setError(''); setSent(false);
    try {
      await requestJoin(clubId, profileId);
      setOptions(current => current.map(option => option.club.id === clubId ? { ...option, status: 'PENDING' } : option));
      setSent(true);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <Modal show onHide={onClose} backdrop keyboard centered dialogClassName="join-club-dialog" aria-labelledby="join-club-title">
    <Modal.Header><Modal.Title id="join-club-title">{t('join', 'Join club')}</Modal.Title></Modal.Header>
    <Modal.Body>
      <p className="join-club-period">{t('matchingPeriod', 'Clubs matching this profile’s period')} <PeriodBadge period={period} /></p>
      <Form.Control autoFocus aria-label={t('searchClubs', 'Search clubs')} placeholder={t('searchClubs', 'Search clubs')} value={query} maxLength={120} disabled={busy} onChange={event => setQuery(event.target.value)} />
      {error && <Alert variant="danger">{error}</Alert>}
      {sent && <Alert variant="success" role="status">{t('requestSent', 'Request sent. A club admin will review it.')}</Alert>}
      <div ref={results} className="join-club-results" role="region" aria-label={t('searchResults', 'Club search results')} tabIndex={0}
        onScroll={event => {
          const element = event.currentTarget;
          if (!searchError && element.scrollHeight - element.scrollTop - element.clientHeight < 100) loadMore.current();
        }}>
        <ul className="join-club-tiles">{options.map(({ club, status }) => <li key={club.id} className="join-club-tile">
          {club.photoUrl && <img className="join-club-photo" src={club.photoUrl} alt="" loading="lazy" />}
          <Link to={`/clubs/${club.id}`} onClick={onClose}>{club.name}</Link>
          <PeriodBadge period={club.period} />
          <Button size="sm" variant="outline-secondary" disabled={busy || status === 'MEMBER' || status === 'PENDING'} onClick={() => send(club.id)}>
            {status === 'MEMBER' ? t('member', 'Member') : status === 'PENDING' ? t('pending', 'Request pending') : status === 'REJECTED' ? t('requestAgain', 'Request again') : t('requestJoin', 'Request to join')}
          </Button>
        </li>)}</ul>
        {loading && <p className="mt-3" role="status">{t('searching', 'Searching clubs…')}</p>}
        {!loading && !searchError && options.length === 0 && <p>{t('noMatches', 'No matching clubs.')}</p>}
        {searchError && <Alert variant="danger">{searchError} <Button variant="link" onClick={() => loadMore.current()}>{t('retry', 'Retry')}</Button></Alert>}
      </div>
    </Modal.Body>
  </Modal>;
}
