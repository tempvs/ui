import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useIntl } from 'react-intl';

import { buildProfileLabel } from '../profile/currentProfile';
import { Profile } from '../profile/profileTypes';
import { PeriodBadge } from '../util/periods';
import TextFilterInput from '../component/TextFilterInput';
import { getClubFollowers } from './clubApi';

type ClubFollowersPanelProps = {
  clubId: string;
  revision: number;
};

export default function ClubFollowersPanel({ clubId, revision }: ClubFollowersPanelProps) {
  const intl = useIntl();
  const t = (key: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${key}`, defaultMessage });
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState('');
  const loadMoreRef = useRef<() => void>(() => {});

  useEffect(() => {
    let active = true;
    let fetching = false;
    let nextToken: string | undefined;
    let more = true;
    setFollowers([]);
    setLoading(true);
    setError('');
    setHasMore(false);

    const load = async () => {
      if (!active || fetching || !more) return;
      fetching = true;
      setLoading(true);
      try {
        const page = await getClubFollowers(clubId, nextToken);
        if (!active) return;
        setFollowers(current => {
          const existing = new Set(current.map(profile => String(profile.id)));
          return [...current, ...page.content.filter(profile => !existing.has(String(profile.id)))];
        });
        nextToken = page.nextToken;
        more = page.hasMore;
        setHasMore(more);
      } catch (caught) {
        if (!active) return;
        setError((caught as Error).message || 'Unable to load followers right now.');
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };

    loadMoreRef.current = load;
    void load();
    return () => { active = false; };
  }, [clubId, revision]);

  const visibleFollowers = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    if (!query) return followers;
    return followers.filter(profile => buildProfileLabel(profile).toLocaleLowerCase().includes(query));
  }, [filter, followers]);

  return <section className="club-panel">
    <div className="club-list-heading">
      <h2>{t('followers', 'Followers')}</h2>
      <TextFilterInput
        value={filter}
        onChange={setFilter}
        placeholder={t('filterFollowers', 'Filter followers')}
        ariaLabel={t('filterFollowers', 'Filter followers')}
        className="club-list-filter"
      />
    </div>
    {error && <Alert variant="danger">{error} <Button variant="link" onClick={() => void loadMoreRef.current()}>{t('retry', 'Retry')}</Button></Alert>}
    {!loading && !error && followers.length === 0 && <p>{t('noFollowers', 'No followers yet.')}</p>}
    {!loading && !error && followers.length > 0 && visibleFollowers.length === 0 && <p>{t('noMatchingFollowers', 'No followers match this filter.')}</p>}
    <div
      className="club-scroll-list"
      role="region"
      aria-label={t('followers', 'Followers')}
      onScroll={event => {
        const element = event.currentTarget;
        if (hasMore && !loading && element.scrollTop + element.clientHeight >= element.scrollHeight - 80) {
          void loadMoreRef.current();
        }
      }}
    >
      <ul className="club-member-list">{visibleFollowers.map(profile => <li key={profile.id}>
        <span><Link to={`/profile/${profile.alias || profile.id}`}>{buildProfileLabel(profile)}</Link> <PeriodBadge period={profile.period} /></span>
      </li>)}</ul>
      {loading && <p role="status" className="text-muted mb-2">{t('loadingFollowers', 'Loading followers…')}</p>}
    </div>
  </section>;
}
