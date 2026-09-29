import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { FaUserMinus } from 'react-icons/fa';

import { buildProfileLabel } from '../profile/currentProfile';
import { Profile } from '../profile/profileTypes';
import TextFilterInput from '../component/TextFilterInput';
import ConfirmationModal from '../component/ConfirmationModal';
import ProfileList from '../profile/components/ProfileList';
import { getClubFollowers } from './clubApi';

type ClubFollowersPanelProps = {
  clubId: string;
  revision: number;
  canManage?: boolean;
  onRemove?: (profile: Profile) => Promise<void>;
};

const RemoveFollowerIcon = FaUserMinus as React.ComponentType<{ 'aria-hidden'?: string }>;

export default function ClubFollowersPanel({ clubId, revision, canManage = false, onRemove }: ClubFollowersPanelProps) {
  const intl = useIntl();
  const t = (key: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${key}`, defaultMessage });
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState('');
  const [removing, setRemoving] = useState<Profile | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState('');
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
  const removeFollower = async () => {
    if (!removing || !onRemove) return;
    setRemoveBusy(true); setRemoveError('');
    try {
      await onRemove(removing);
      setFollowers(current => current.filter(profile => String(profile.id) !== String(removing.id)));
      setRemoving(null);
    } catch (caught) {
      setRemoveError((caught as Error).message || t('removeFollowerFailed', 'Unable to remove this follower right now.'));
    } finally { setRemoveBusy(false); }
  };

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
    {removeError && <Alert variant="danger">{removeError}</Alert>}
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
      <ProfileList profiles={visibleFollowers} className="club-member-list" renderActions={profile => canManage && onRemove ? <Button size="sm" variant="outline-danger" className="club-icon-action" title={t('removeFollower', 'Remove follower')} aria-label={t('removeFollower', 'Remove follower')} onClick={() => { setRemoveError(''); setRemoving(profile); }}>
        <RemoveFollowerIcon aria-hidden="true" />
      </Button> : null} />
      {loading && <p role="status" className="text-muted mb-2">{t('loadingFollowers', 'Loading followers…')}</p>}
    </div>
    <ConfirmationModal
      show={removing != null}
      title={t('removeFollower', 'Remove follower')}
      message={<>Remove <strong>{removing ? buildProfileLabel(removing) : ''}</strong> as a follower of this club?</>}
      confirmLabel={t('remove', 'Remove')}
      cancelLabel={t('cancel', 'Cancel')}
      busy={removeBusy}
      onHide={() => { if (!removeBusy) setRemoving(null); }}
      onConfirm={() => { void removeFollower(); }}
    />
  </section>;
}
