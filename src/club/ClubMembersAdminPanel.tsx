import React, { useEffect, useRef, useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { FaUserMinus } from "react-icons/fa";

import ConfirmationModal from "../component/ConfirmationModal";
import ProfileCollectionPanel from "../profile/components/ProfileCollectionPanel";
import { buildProfileLabel } from "../profile/currentProfile";
import { Profile } from "../profile/profileTypes";
import { detachProfile, getParticipants } from "./clubApi";

type Props = {
  clubId: string | number;
  revision?: number;
  onChanged?: () => void;
};

const RemoveMemberIcon = FaUserMinus as React.ComponentType<{
  "aria-hidden"?: string;
}>;

/** Administration-only member list. Detail pages deliberately remain read-only. */
export default function ClubMembersAdminPanel({
  clubId,
  revision = 0,
  onChanged,
}: Props) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [removing, setRemoving] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const loadMoreRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let active = true;
    let fetching = false;
    let more = true;
    let nextToken: string | undefined;
    setMembers([]);
    setError("");
    setLoading(true);
    setHasMore(false);

    const load = async () => {
      if (!active || fetching || !more) return;
      fetching = true;
      setLoading(true);
      try {
        const page = await getParticipants(clubId, nextToken);
        if (!active) return;
        setMembers((current) => {
          const ids = new Set(current.map((profile) => String(profile.id)));
          return [
            ...current,
            ...page.content.filter((profile) => !ids.has(String(profile.id))),
          ];
        });
        nextToken = page.nextToken;
        more = page.hasMore;
        setHasMore(more);
      } catch (caught) {
        if (active)
          setError((caught as Error).message || "Unable to load members.");
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };
    loadMoreRef.current = load;
    void load();
    return () => {
      active = false;
    };
  }, [clubId, revision]);

  const removeMember = async () => {
    if (!removing) return;
    setBusy(true);
    setError("");
    try {
      await detachProfile(clubId, removing.id);
      setMembers((current) =>
        current.filter((profile) => String(profile.id) !== String(removing.id)),
      );
      setRemoving(null);
      onChanged?.();
    } catch (caught) {
      setError((caught as Error).message || "Unable to remove this member.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error && <Alert variant="danger">{error}</Alert>}
      <ProfileCollectionPanel
        title="Members"
        profiles={members}
        filterPlaceholder="Filter members"
        emptyText="No members yet."
        noMatchesText="No members match this filter."
        loading={loading}
        error=""
        onRetry={() => void loadMoreRef.current()}
        onReachEnd={hasMore && !loading ? () => void loadMoreRef.current() : undefined}
        renderActions={(profile) => (
          <Button
            size="sm"
            variant="outline-danger"
            className="club-icon-action"
            title="Remove member"
            aria-label="Remove member"
            onClick={() => setRemoving(profile)}
          >
            <RemoveMemberIcon aria-hidden="true" />
          </Button>
        )}
      />
      <ConfirmationModal
        show={removing != null}
        title="Remove member"
        message={
          <>Remove <strong>{removing ? buildProfileLabel(removing) : ""}</strong> from this club?</>
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        busy={busy}
        onHide={() => {
          if (!busy) setRemoving(null);
        }}
        onConfirm={() => void removeMember()}
      />
    </>
  );
}
