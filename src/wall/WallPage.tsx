import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Spinner } from 'react-bootstrap';

import ConfirmationModal from '../component/ConfirmationModal';
import { getFollowedClubs, getProfileClubs } from '../club/clubApi';
import { getFollowedEvents, getParticipatingEvents } from '../event/eventApi';
import { resolveCurrentOwnedProfileId } from '../profile/currentProfile';
import { fetchClubProfiles, getFollowingProfiles, getUserProfileByUserId } from '../profile/profileApi';
import { getGroupItems, getProfileStash } from '../profile/stashApi';
import { Profile } from '../profile/profileTypes';
import ActivityCard from './ActivityCard';
import { dismissWallItem, getWall, getWallThumbnails, WallActivity, WallTarget } from './wallApi';
import './wall.css';

function clubProfiles(userId: string) {
  return new Promise<Profile[]>((resolve, reject) => fetchClubProfiles(userId, { onSuccess: resolve, onError: () => reject(new Error('Profiles could not be loaded')) }));
}

async function targetsFor(profileId: string): Promise<WallTarget[]> {
  const targets: WallTarget[] = [{ type: 'PROFILE', id: profileId, reason: 'OWN_PROFILE' }];
  const results = await Promise.allSettled([
    getFollowingProfiles(profileId), getFollowedClubs(profileId), getProfileClubs(profileId),
    getFollowedEvents(profileId), getParticipatingEvents(profileId), getProfileStash(profileId),
  ]);
  const add = (type: WallTarget['type'], id: unknown, reason: WallTarget['reason']) => {
    if (id != null) targets.push({ type, id: String(id), reason });
  };
  if (results[0].status === 'fulfilled') results[0].value.forEach(item => add('PROFILE', item.id, 'FOLLOWED_PROFILE'));
  if (results[1].status === 'fulfilled') results[1].value.forEach(item => add('CLUB', item.id, 'FOLLOWED_CLUB'));
  if (results[2].status === 'fulfilled') results[2].value.forEach(item => add('CLUB', item.id, 'CLUB_MEMBER'));
  if (results[3].status === 'fulfilled') results[3].value.content?.forEach(item => add('EVENT', item.id, 'FOLLOWED_EVENT'));
  if (results[4].status === 'fulfilled') results[4].value.content?.forEach(item => add('EVENT', item.id, 'EVENT_PARTICIPANT'));
  if (results[5].status === 'fulfilled') {
    const groups = results[5].value.groups || [];
    const itemPages = await Promise.allSettled(groups.map(group => getGroupItems(group.id)));
    itemPages.forEach(page => { if (page.status === 'fulfilled') page.value.forEach(item => item.sources?.forEach(sourceId => add('SOURCE', sourceId, 'SOURCE_USED'))); });
  }
  return Array.from(new Map(targets.map(target => [`${target.type}:${target.id}:${target.reason}`, target])).values());
}

export default function WallPage({ userId }: { userId: string }) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [targets, setTargets] = useState<WallTarget[]>([]);
  const [activities, setActivities] = useState<WallActivity[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, { id?: string | number | null; url?: string | null; thumbnailUrl?: string | null } | null>>({});
  const [nextToken, setNextToken] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [dismissTarget, setDismissTarget] = useState<WallActivity | null>(null);
  const [dismissing, setDismissing] = useState(false);

  const load = useCallback(async (activeProfileId: string, wallTargets: WallTarget[], token?: string) => {
    const page = await getWall(activeProfileId, wallTargets, token);
    const resources = Array.from(new Map(page.content.map(activity => {
      const resourceType = activity.targetType.toLowerCase();
      const resourceId = activity.targetId;
      return [`${resourceType}:${resourceId}`, { resourceType, resourceId }];
    })).values());
    // A missing image is a normal case. Keep the activity visible and let the
    // shared image component render its hourglass; do not fall back to N
    // individual image metadata calls.
    const thumbnailPage = resources.length ? await getWallThumbnails(resources).catch(() => undefined) : undefined;
    const nextThumbnails = Object.fromEntries((thumbnailPage?.content || []).map(entry => [
      `${entry.resourceType}:${entry.resourceId}`,
      entry.image,
    ]));
    setActivities(current => token ? [...current, ...page.content] : page.content);
    setThumbnails(current => token ? { ...current, ...nextThumbnails } : nextThumbnails);
    setNextToken(page.nextToken);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(undefined);
    Promise.all([getUserProfileByUserId(userId), clubProfiles(userId)]).then(async ([personal, clubs]) => {
      const selectedId = resolveCurrentOwnedProfileId([...(personal ? [personal] : []), ...clubs]);
      if (!selectedId) throw new Error('Create a profile to see your wall.');
      const wallTargets = await targetsFor(selectedId);
      if (!active) return;
      setProfileId(selectedId); setTargets(wallTargets);
      await load(selectedId, wallTargets);
    }).catch(reason => { if (active) setError((reason as Error).message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, userId]);

  const loadMore = async () => {
    if (!profileId || !nextToken) return;
    setLoadingMore(true); setError(undefined);
    try { await load(profileId, targets, nextToken); } catch (reason) { setError((reason as Error).message); } finally { setLoadingMore(false); }
  };
  const dismiss = async () => {
    if (!profileId || !dismissTarget) return;
    setDismissing(true);
    try { await dismissWallItem(profileId, dismissTarget.id); setActivities(items => items.filter(item => item.id !== dismissTarget.id)); setDismissTarget(null); }
    catch (reason) { setError((reason as Error).message); }
    finally { setDismissing(false); }
  };

  return <main className="wall-page">
    <div className="wall-header"><div><h1>Your wall</h1><p>Recent updates from profiles, clubs, events, and sources that matter to your current profile.</p></div></div>
    {error && <Alert variant="danger">{error}</Alert>}
    {loading ? <div className="wall-loading"><Spinner animation="border" size="sm" /> Loading updates…</div>
      : activities.length ? <div className="wall-list">{activities.map(item => <ActivityCard key={item.id} activity={item} thumbnail={thumbnails[`${item.targetType.toLowerCase()}:${item.targetId}`]} onDismiss={setDismissTarget} />)}</div>
        : !error && <div className="wall-empty"><h2>No updates yet</h2><p>Follow profiles, clubs, or events and their newest activity will appear here.</p></div>}
    {nextToken && <Button variant="outline-secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading…' : 'Load more'}</Button>}
    <ConfirmationModal show={Boolean(dismissTarget)} title="Dismiss update?" message="This update will no longer appear on the wall for this profile." onHide={() => setDismissTarget(null)} onConfirm={() => void dismiss()} confirmLabel="Dismiss" busy={dismissing} />
  </main>;
}
