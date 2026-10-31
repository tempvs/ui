import { useEffect, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { Link } from "react-router-dom";

import {
  commentOnMapPlaceProposal,
  listMapPlaceProposalActivity,
  type MapPlaceProposalActivity,
} from "./mapApi";
import { getUserProfilesByUserIds } from "../profile/profileApi";
import { buildProfileLabel } from "../profile/currentProfile";
import type { Profile } from "../profile/profileTypes";

/** Private, author-or-reviewer-only discussion for one proposed place. The
 * API enforces access; this component merely presents its audit trail. */
export default function ProposalActivityPanel({
  proposalId,
  proposalName,
}: {
  proposalId: string;
  proposalName: string;
}) {
  const [activity, setActivity] = useState<MapPlaceProposalActivity[]>([]);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  useEffect(() => {
    let active = true;
    setError("");
    void listMapPlaceProposalActivity(proposalId)
      .then((items) => {
        if (active) setActivity(items);
      })
      .catch((caught: unknown) => {
        if (active)
          setError(
            (caught as Error).message || "Unable to load proposal discussion.",
          );
      });
    return () => {
      active = false;
    };
  }, [proposalId]);

  useEffect(() => {
    const userIds = Array.from(
      new Set(activity.map((entry) => entry.actorUserId)),
    );
    if (!userIds.length) return;
    let active = true;
    void getUserProfilesByUserIds(userIds).then((items) => {
      if (!active) return;
      setProfiles(Object.fromEntries(items.map((profile) => [profile.userId, profile])));
    });
    return () => {
      active = false;
    };
  }, [activity]);

  const addComment = async () => {
    const value = comment.trim();
    if (!value) return;
    setSending(true);
    setError("");
    try {
      const saved = await commentOnMapPlaceProposal(proposalId, value);
      setActivity((current) => [...current, saved]);
      setComment("");
    } catch (caught) {
      setError((caught as Error).message || "Unable to add proposal comment.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3" aria-label="Private proposal discussion">
      <strong className="small">Review history</strong>
      {error && <p className="small text-danger mb-1">{error}</p>}
      <ul className="list-unstyled small mb-2">
        {activity.map((entry, index) => (
          <li key={entry.id} className="border-top py-1">
            <strong>{activityLabel(entry.kind)}</strong>
            <span className="text-muted"> by </span>
            <ProposalAuthor userId={entry.actorUserId} profiles={profiles} />
            {entry.note && <div>{entry.note}</div>}
            {entry.revision && (
              <>
                <div className="text-muted">
                  Revision {entry.revision.version}:{" "}
                  {entry.revision.canonicalName}
                  {" · "}
                  {entry.revision.latitude.toFixed(6)},{" "}
                  {entry.revision.longitude.toFixed(6)}
                  {entry.revision.names.filter((name) => !name.preferred)
                    .length > 0 && (
                    <>
                      {" · aliases: "}
                      {entry.revision.names
                        .filter((name) => !name.preferred)
                        .map((name) => name.value)
                        .join(", ")}
                    </>
                  )}
                </div>
                {previousRevision(activity, index) && (
                  <RevisionDiff
                    previous={previousRevision(activity, index)!}
                    next={entry.revision}
                  />
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="d-flex gap-2">
        <Form.Control
          aria-label={`Comment on ${proposalName}`}
          value={comment}
          maxLength={2000}
          placeholder="Private comment"
          onChange={(event) => setComment(event.target.value)}
        />
        <Button
          size="sm"
          variant="outline-dark"
          disabled={!comment.trim() || sending}
          onClick={() => void addComment()}
        >
          Comment
        </Button>
      </div>
    </div>
  );
}

function ProposalAuthor({
  userId,
  profiles,
}: {
  userId: string;
  profiles: Record<string, Profile>;
}) {
  const profile = profiles[userId];
  if (!profile) return <span className="text-muted">Unknown profile</span>;
  return (
    <Link to={`/profile/${profile.alias || profile.id}`}>
      {buildProfileLabel(profile)}
    </Link>
  );
}

function previousRevision(
  activity: MapPlaceProposalActivity[],
  index: number,
): NonNullable<MapPlaceProposalActivity["revision"]> | null {
  for (let offset = index - 1; offset >= 0; offset -= 1) {
    const revision = activity[offset].revision;
    if (revision) return revision;
  }
  return null;
}

/** Immutable snapshots make amendments reviewable as an actual field diff,
 * rather than forcing reviewers to infer changes from two terse summaries. */
function RevisionDiff({
  previous,
  next,
}: {
  previous: NonNullable<MapPlaceProposalActivity["revision"]>;
  next: NonNullable<MapPlaceProposalActivity["revision"]>;
}) {
  const values = [
    ["Name", previous.canonicalName, next.canonicalName],
    ["Type", previous.featureType, next.featureType],
    [
      "Coordinates",
      `${previous.latitude.toFixed(6)}, ${previous.longitude.toFixed(6)}`,
      `${next.latitude.toFixed(6)}, ${next.longitude.toFixed(6)}`,
    ],
    ["Aliases", aliases(previous), aliases(next)],
    ["Important events", events(previous), events(next)],
    ["Description", previous.description || "—", next.description || "—"],
    ["Parent", previous.parentPlaceId || "—", next.parentPlaceId || "—"],
    [
      "Periods",
      previous.periods?.join(", ") || "—",
      next.periods?.join(", ") || "—",
    ],
    ["Evidence URL", previous.citationUrl || "—", next.citationUrl || "—"],
  ];
  const changed = values.filter(([, before, after]) => before !== after);
  if (!changed.length) return null;

  return (
    <details className="mt-1" aria-label={`Revision ${next.version} changes`}>
      <summary>Show changes from revision {previous.version}</summary>
      <ul className="mb-0 mt-1 ps-3">
        {changed.map(([field, before, after]) => (
          <li key={field}>
            <strong>{field}:</strong>{" "}
            <span className="text-danger text-decoration-line-through">
              {before}
            </span>
            {" → "}
            <span className="text-success">{after}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function aliases(
  revision: NonNullable<MapPlaceProposalActivity["revision"]>,
): string {
  return (
    revision.names
      .filter((name) => !name.preferred)
      .map((name) => name.value)
      .join(", ") || "—"
  );
}

function events(
  revision: NonNullable<MapPlaceProposalActivity["revision"]>,
): string {
  return (
    revision.historicalEvents
      ?.map(
        (event) =>
          `${event.validFrom ?? "?"}${event.validTo === event.validFrom ? "" : `–${event.validTo ?? "?"}`}: ${event.description}`,
      )
      .join("; ") || "—"
  );
}

function activityLabel(kind: MapPlaceProposalActivity["kind"]): string {
  return {
    SUBMITTED: "Submitted",
    AMENDED: "Amended",
    CHANGES_REQUESTED: "Changes requested",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    MERGED: "Merged",
    COMMENTED: "Comment",
  }[kind];
}
