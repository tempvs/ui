import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { FaUserMinus } from 'react-icons/fa';

import ConfirmationModal from '../component/ConfirmationModal';
import ProfileCollectionPanel from '../profile/components/ProfileCollectionPanel';
import { buildProfileLabel } from '../profile/currentProfile';
import { Profile } from '../profile/profileTypes';
import { getClubFollowers } from './clubApi';

type Props = { clubId: string; revision: number; canManage?: boolean; onRemove?: (profile: Profile) => Promise<void> };
const RemoveFollowerIcon = FaUserMinus as React.ComponentType<{ 'aria-hidden'?: string }>;

export default function ClubFollowersPanel({ clubId, revision, canManage = false, onRemove }: Props) {
  const intl = useIntl();
  const t = (key: string, defaultMessage: string) => intl.formatMessage({ id: `clubs.${key}`, defaultMessage });
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [removing, setRemoving] = useState<Profile | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const loadMoreRef = useRef<() => void>(() => {});

  useEffect(() => {
    let active = true, fetching = false, more = true;
    let nextToken: string | undefined;
    setFollowers([]); setLoading(true); setError(''); setHasMore(false);
    const load = async () => {
      if (!active || fetching || !more) return;
      fetching = true; setLoading(true);
      try {
        const page = await getClubFollowers(clubId, nextToken);
        if (!active) return;
        setFollowers(current => {
          const existing = new Set(current.map(profile => String(profile.id)));
          return [...current, ...page.content.filter(profile => !existing.has(String(profile.id)))];
        });
        nextToken = page.nextToken; more = page.hasMore; setHasMore(more);
      } catch (caught) {
        if (active) setError((caught as Error).message || 'Unable to load followers right now.');
      } finally { fetching = false; if (active) setLoading(false); }
    };
    loadMoreRef.current = load; void load();
    return () => { active = false; };
  }, [clubId, revision]);

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

  return <>
    <ProfileCollectionPanel title={t('followers', 'Followers')} profiles={followers} filterPlaceholder={t('filterFollowers', 'Filter followers')} emptyText={t('noFollowers', 'No followers yet.')} noMatchesText={t('noMatchingFollowers', 'No followers match this filter.')} loading={loading} error={error} onRetry={() => void loadMoreRef.current()} onReachEnd={hasMore && !loading ? () => void loadMoreRef.current() : undefined} renderActions={profile => canManage && onRemove ? <Button size="sm" variant="outline-danger" className="club-icon-action" title={t('removeFollower', 'Remove follower')} aria-label={t('removeFollower', 'Remove follower')} onClick={() => { setRemoveError(''); setRemoving(profile); }}><RemoveFollowerIcon aria-hidden="true" /></Button> : null} />
    {removeError && <Alert variant="danger">{removeError}</Alert>}
    <ConfirmationModal show={removing != null} title={t('removeFollower', 'Remove follower')} message={<>Remove <strong>{removing ? buildProfileLabel(removing) : ''}</strong> as a follower of this club?</>} confirmLabel={t('remove', 'Remove')} cancelLabel={t('cancel', 'Cancel')} busy={removeBusy} onHide={() => { if (!removeBusy) setRemoving(null); }} onConfirm={() => { void removeFollower(); }} />
  </>;
}
