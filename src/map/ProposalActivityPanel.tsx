import { useEffect, useState } from "react";
import { Button, Form } from "react-bootstrap";

import {
  commentOnMapPlaceProposal,
  listMapPlaceProposalActivity,
  type MapPlaceProposalActivity,
} from "./mapApi";

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
        {activity.map((entry) => (
          <li key={entry.id} className="border-top py-1">
            <strong>{activityLabel(entry.kind)}</strong>
            <span className="text-muted"> by {entry.actorUserId}</span>
            {entry.note && <div>{entry.note}</div>}
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
