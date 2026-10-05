import { useCallback, useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";

import ConfirmationModal from "../../component/ConfirmationModal";
import Spinner from "../../component/Spinner";
import { getErrorMessage } from "../../util/errors";
import {
  applySourceProposal,
  getLibraryViewer,
  getSource,
  getSourceProposals,
  rejectSourceProposal,
  type LibrarySource,
  type SourceChangeProposal,
} from "../libraryApi";
import { canEditSource } from "../libraryRoles";
import { formatSourceChangeValue, sourceChangeFieldLabel } from "../sourceChangeDisplay";
import { getUserProfilesByUserIds } from "../../profile/profileApi";
import { buildProfileLabel } from "../../profile/currentProfile";
import type { Profile } from "../../profile/profileTypes";
import LibrarySectionHeader from "../components/LibrarySectionHeader";

const PAGE_SIZE = 20;

/** Dedicated review queue for one source; the source page only exposes its count. */
export default function LibrarySourceProposalsPage() {
  const { sourceId } = useParams();
  const [source, setSource] = useState<LibrarySource | null>(null);
  const [proposals, setProposals] = useState<SourceChangeProposal[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<SourceChangeProposal | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [authors, setAuthors] = useState<Record<string, Profile>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sourceResult, viewer, proposalsResult] = await Promise.all([
        getSource(sourceId),
        getLibraryViewer(),
        getSourceProposals(sourceId),
      ]);
      if (!sourceResult.ok) throw new Error("Unable to load the source.");
      if (!canEditSource(viewer) || !proposalsResult.ok)
        throw new Error("Library editor access is required to review proposals.");
      setViewerUserId(viewer?.userId || null);
      setSource(sourceResult.data);
      const rows = proposalsResult.data || [];
      const profiles = await getUserProfilesByUserIds(rows.map((proposal) => proposal.proposerId)).catch(() => []);
      setAuthors(Object.fromEntries(profiles.filter((profile) => Boolean(profile.userId)).map((profile) => [String(profile.userId), profile])));
      setProposals(rows);
      setVisible(PAGE_SIZE);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (proposal: SourceChangeProposal, approved: boolean) => {
    setBusy(proposal.id);
    setError(null);
    try {
      const result = approved
        ? await applySourceProposal(sourceId, proposal.id)
        : await rejectSourceProposal(sourceId, proposal.id);
      if (!result.ok) throw new Error("Unable to review the source proposal.");
      setRejecting(null);
      await load();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page-layout-content px-4 px-xl-5 pb-4">
      <LibrarySectionHeader
        title="LIBRARY"
        subtitle={null}
        rightContent={source ? <Link className="btn btn-outline-dark btn-sm" to={`/library/source/${source.id}`}>Back to source</Link> : null}
      />
      <div className="d-flex justify-content-between align-items-center gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="h3 mb-1">Pending proposals</h1>
          {source && <div className="text-muted">{source.name}</div>}
        </div>
      </div>
      {error && <div className="tempvs-plain-message text-danger">{error}</div>}
      {loading && <Spinner />}
      {!loading && proposals.length === 0 && <div className="tempvs-plain-message text-muted">No pending proposals for this source.</div>}
      {!loading && proposals.slice(0, visible).map((proposal) => {
        const ownProposal = proposal.proposerId === viewerUserId;
        const author = authors[proposal.proposerId];
        const authorLabel = ownProposal ? "You" : author ? buildProfileLabel(author) : "Unknown profile";
        const authorPath = author ? `/profile/${author.alias || author.id}` : undefined;
        return <div key={proposal.id} className="stash-shell p-3 mb-2 d-flex justify-content-between gap-3 flex-wrap">
          <div>
            <strong>{Object.entries(proposal.changes).map(([field, value]) => `${sourceChangeFieldLabel(field)}: ${formatSourceChangeValue(value)}`).join(" · ")}</strong>
            <div className="small text-muted">Proposed by {authorPath ? <Link to={authorPath}>{authorLabel}</Link> : authorLabel} on {new Date(proposal.createdAt).toLocaleString()}</div>
          </div>
          <div className="d-flex gap-2 align-items-center">
            <Button size="sm" variant="outline-success" disabled={busy !== null || ownProposal} onClick={() => void review(proposal, true)}>Approve</Button>
            <Button size="sm" variant="outline-danger" disabled={busy !== null || ownProposal} onClick={() => setRejecting(proposal)}>Reject</Button>
          </div>
        </div>;
      })}
      {!loading && visible < proposals.length && <Button variant="outline-dark" onClick={() => setVisible((count) => count + PAGE_SIZE)}>Load more</Button>}
      <ConfirmationModal
        show={Boolean(rejecting)}
        title="Reject source proposal"
        message="Reject this proposed source change? The source will remain unchanged."
        confirmLabel="Reject proposal"
        busy={busy !== null}
        onHide={() => !busy && setRejecting(null)}
        onConfirm={() => rejecting && void review(rejecting, false)}
      />
    </div>
  );
}
