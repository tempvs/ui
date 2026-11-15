import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button } from "react-bootstrap";

import ConfirmationModal from "../component/ConfirmationModal";
import PageLayout from "../component/PageLayout";
import Spinner from "../component/Spinner";
import {
  resolveCurrentOwnedProfileId,
  useCurrentProfileValue,
} from "../profile/currentProfile";
import {
  fetchClubProfiles,
  getUserProfileByUserId,
} from "../profile/profileApi";
import { Profile } from "../profile/profileTypes";
import ActivityCard from "./ActivityCard";
import {
  dismissWallItem,
  getWall,
  getWallThumbnails,
  WallActivity,
} from "./wallApi";
import "./wall.css";

function clubProfiles(userId: string) {
  return new Promise<Profile[]>((resolve, reject) =>
    fetchClubProfiles(userId, {
      onSuccess: resolve,
      onError: () => reject(new Error("Profiles could not be loaded")),
    }),
  );
}

export default function WallPage({
  userId,
  emptyContent,
}: {
  userId: string;
  emptyContent?: React.ReactNode;
}) {
  const currentProfileValue = useCurrentProfileValue();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [activities, setActivities] = useState<WallActivity[]>([]);
  const [thumbnails, setThumbnails] = useState<
    Record<
      string,
      {
        id?: string | number | null;
        url?: string | null;
        thumbnailUrl?: string | null;
      } | null
    >
  >({});
  const [nextToken, setNextToken] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [dismissTarget, setDismissTarget] = useState<WallActivity | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const request = useRef<AbortController | null>(null);
  const moreInFlight = useRef(false);

  const load = useCallback(
    async (
      activeProfileId: string,
      signal: AbortSignal,
      token?: string,
    ) => {
      let page = await getWall(activeProfileId, undefined, token, signal);
      // Server discovery and large merge checkpoints can yield an empty,
      // advancing page. Follow a few automatically without claiming exhaustion.
      for (let reads = 1; !page.content.length && page.nextToken && reads < 4; reads++) {
        signal.throwIfAborted();
        page = await getWall(activeProfileId, undefined, page.nextToken, signal);
      }
      if (signal.aborted) return;
      setActivities((current) =>
        token ? [...current, ...page.content] : page.content,
      );
      setNextToken(page.nextToken);
      if (!token) setThumbnails({});
      // Activity text is useful immediately. Optional images must not delay it.
      const resources = Array.from(
        new Map(
          page.content.map((activity) => {
            const resourceType = activity.targetType.toLowerCase();
            const resourceId = activity.targetId;
            return [
              `${resourceType}:${resourceId}`,
              { resourceType, resourceId },
            ];
          }),
        ).values(),
      );
      // A missing image is a normal case. Keep the activity visible and let the
      // shared image component render its hourglass; do not fall back to N
      // individual image metadata calls.
      if (resources.length)
        void getWallThumbnails(resources, signal)
          .then((entries) => {
            if (signal.aborted) return;
            const images = Object.fromEntries(
              entries.map((entry) => [
                `${entry.resourceType}:${entry.resourceId}`,
                entry.image,
              ]),
            );
            setThumbnails((current) => ({ ...current, ...images }));
          })
          .catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    moreInFlight.current = false;
    setLoadingMore(false);
    setLoading(true);
    setError(undefined);
    setNextToken(undefined);
    setProfileId(null);
    setDismissTarget(null);
    setDismissing(false);
    Promise.all([getUserProfileByUserId(userId), clubProfiles(userId)])
      .then(async ([personal, clubs]) => {
        if (controller.signal.aborted) return;
        const selectedId = resolveCurrentOwnedProfileId([
          ...(personal ? [personal] : []),
          ...clubs,
        ]);
        if (!selectedId) throw new Error("Create a profile to see your wall.");
        setProfileId(selectedId);
        await load(selectedId, controller.signal);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError((reason as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [currentProfileValue, load, userId, attempt]);

  const loadMore = async () => {
    const signal = request.current?.signal;
    if (
      !profileId ||
      !nextToken ||
      !signal ||
      signal.aborted ||
      moreInFlight.current
    )
      return;
    moreInFlight.current = true;
    setLoadingMore(true);
    setError(undefined);
    try {
      await load(profileId, signal, nextToken);
    } catch (reason) {
      if (!signal.aborted) setError((reason as Error).message);
    } finally {
      if (!signal.aborted) {
        moreInFlight.current = false;
        setLoadingMore(false);
      }
    }
  };
  const dismiss = async () => {
    if (!profileId || !dismissTarget) return;
    const signal = request.current?.signal;
    setDismissing(true);
    try {
      await dismissWallItem(profileId, dismissTarget.id);
      if (signal?.aborted) return;
      setActivities((items) =>
        items.filter((item) => item.id !== dismissTarget.id),
      );
      setDismissTarget(null);
    } catch (reason) {
      if (!signal?.aborted) setError((reason as Error).message);
    } finally {
      if (!signal?.aborted) setDismissing(false);
    }
  };

  return (
    <PageLayout header={{ title: "Wall" }}>
      <div className="wall-page">
        <div className="wall-header">
          <div>
            <h1>Your wall</h1>
            <p>
              Recent updates from profiles, clubs, events, and sources that
              matter to your current profile.
            </p>
          </div>
        </div>
        {error && <Alert variant="danger">{error} <Button variant="outline-danger" size="sm" onClick={() => setAttempt((value) => value + 1)}>Reload wall</Button></Alert>}
        {loading ? (
          <div className="wall-loading">
            <Spinner size="sm" /> Loading updates…
          </div>
        ) : activities.length ? (
          <div className="wall-list">
            {activities.map((item) => (
              <ActivityCard
                key={item.id}
                activity={item}
                thumbnail={
                  thumbnails[
                    `${item.targetType.toLowerCase()}:${item.targetId}`
                  ]
                }
                onDismiss={setDismissTarget}
              />
            ))}
          </div>
        ) : (
          !error && (
            <div className="wall-empty">
              <h2>{nextToken ? "Still checking for updates" : "No updates yet"}</h2>
              <p>
                {nextToken
                  ? "More history remains to be checked. Load more to continue."
                  : "Follow profiles, clubs, or events and their newest activity will appear here."}
              </p>
              {emptyContent}
            </div>
          )
        )}
        {nextToken && (
          <Button
            variant="outline-secondary"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        )}
        <ConfirmationModal
          show={Boolean(dismissTarget)}
          title="Dismiss update?"
          message="This update will no longer appear on the wall for this profile."
          onHide={() => setDismissTarget(null)}
          onConfirm={() => void dismiss()}
          confirmLabel="Dismiss"
          busy={dismissing}
        />
      </div>
    </PageLayout>
  );
}
