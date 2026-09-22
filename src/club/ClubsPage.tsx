import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Container, Form } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { Link, useNavigate } from 'react-router-dom';
import defaultImage from '../assets/default-image.png';
import RefreshingImage from '../image/RefreshingImage';
import { fetchCurrentUserInfo } from '../profile/profileApi';
import { PERIODS, getPeriodLabel, PeriodBadge } from '../util/periods';
import { Club, ClubDraft, createClub, isClubServiceUnavailable, listClubs } from './clubApi';
import ClubForm from './ClubForm';
import './clubs.css';

export default function ClubsPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const t = (id: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${id}`, defaultMessage });
  const [clubs, setClubs] = useState<Club[]>([]);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadMore = useRef<() => void>(() => {});

  useEffect(() => fetchCurrentUserInfo(result => setSignedIn(Boolean(result.currentUserId))), []);

  useEffect(() => {
    if (creating) return;
    const controller = new AbortController();
    let active = true, fetching = false, ready = false, more = true, failed = false;
    let nextToken: string | undefined;
    setClubs([]); setLoading(true); setSearchError(''); setHasMore(false); setUnavailable(false);
    const fetchNext = async (retry = false) => {
      if (!active || !ready || fetching || !more || (failed && !retry)) return;
      fetching = true; failed = false; setLoading(true); setSearchError('');
      try {
        const data = await listClubs(query.trim(), period, nextToken, controller.signal);
        if (!active) return;
        setClubs(current => {
          const ids = new Set(current.map(club => club.id));
          return [...current, ...data.content.filter(club => !ids.has(club.id))];
        });
        nextToken = data.nextToken; more = data.hasMore; setHasMore(more);
      } catch (e) {
        failed = true;
        if (active) {
          if (isClubServiceUnavailable(e)) setUnavailable(true);
          else setSearchError((e as Error).message);
        }
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };
    loadMore.current = () => fetchNext(true);
    const checkScroll = () => {
      const element = sentinel.current;
      if (element && element.getClientRects().length > 0 && element.getBoundingClientRect().top <= window.innerHeight + 200) fetchNext();
    };
    window.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    const timer = window.setTimeout(() => { ready = true; fetchNext(); }, 250);
    return () => {
      active = false; controller.abort(); window.clearTimeout(timer);
      window.removeEventListener('scroll', checkScroll); window.removeEventListener('resize', checkScroll);
    };
  }, [query, period, creating]);

  useEffect(() => {
    const element = sentinel.current;
    if (!creating && !loading && hasMore && !searchError && element && element.getClientRects().length > 0 && element.getBoundingClientRect().top <= window.innerHeight + 200) {
      loadMore.current();
    }
  }, [creating, loading, hasMore, searchError, clubs.length]);

  const save = async (draft: ClubDraft) => {
    setBusy(true); setError('');
    try { const club = await createClub(draft); navigate(`/clubs/${club.id}`); }
    catch (e) {
      if (isClubServiceUnavailable(e)) setUnavailable(true);
      else setError((e as Error).message);
    }
    finally { setBusy(false); }
  };
  return <Container className={`clubs-page${unavailable ? ' club-service-unavailable' : ''}`} aria-disabled={unavailable || undefined}>
    <div className="club-page-heading">
      <div><h1>{t('title', 'Clubs')}</h1><p>{t('intro', 'Find the people who bring your period to life.')}</p></div>
      {signedIn && !creating && <Button variant="secondary" disabled={unavailable} onClick={() => setCreating(true)}>{t('create', 'Create club')}</Button>}
    </div>
    {error && <Alert variant="danger">{error}</Alert>}
    {creating ? <section className="club-panel"><h2>{t('create', 'Create club')}</h2><ClubForm busy={busy || unavailable} onSave={save} onCancel={() => setCreating(false)} /></section> : <>
      <div className="club-search">
        <Form.Control aria-label={t('searchClubs', 'Search clubs')} placeholder={t('searchClubs', 'Search clubs')} maxLength={120} value={query} disabled={unavailable} onChange={e => setQuery(e.target.value)} />
        <Form.Select aria-label={t('period', 'Period')} value={period} disabled={unavailable} onChange={e => setPeriod(e.target.value)}>
          <option value="">{t('allPeriods', 'All periods')}</option>
          {PERIODS.map(value => <option key={value} value={value}>{getPeriodLabel(intl, value)}</option>)}
        </Form.Select>
      </div>
      <div className="club-card-grid">{clubs.map(club => <article key={club.id} className="club-panel">
        <PeriodBadge period={club.period} />
        <h2 className="mt-3"><Link className="club-thumbnail-link" to={`/clubs/${club.id}`}>
          <RefreshingImage
            image={{ id: club.photoImageId, resourceType: 'club', resourceId: club.id, url: club.photoUrl, thumbnailUrl: club.photoThumbnailUrl }}
            variant="thumbnail"
            fallbackSrc={defaultImage}
            className="club-list-thumbnail"
            alt=""
            loading="lazy"
          />
          <span>{club.name}</span>
        </Link></h2>
        {club.location && <p className="text-muted">{club.location}</p>}
        <p className="club-card-description">{club.description}</p>
      </article>)}</div>
      {loading && <p role="status">{t('searching', 'Searching clubs…')}</p>}
      {searchError && <Alert variant="danger">{searchError} <Button variant="link" onClick={() => loadMore.current()}>{t('retry', 'Retry')}</Button></Alert>}
      {!loading && !unavailable && !searchError && clubs.length === 0 && <p className="club-panel">{t('empty', 'No clubs found. Start one for your reenactment group.')}</p>}
      <div ref={sentinel} className="clubs-load-sentinel" aria-hidden="true" />
    </>}
  </Container>;
}
