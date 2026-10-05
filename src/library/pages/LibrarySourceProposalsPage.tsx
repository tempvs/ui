import { useCallback, useEffect, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";

import Spinner from "../../component/Spinner";
import { getErrorMessage } from "../../util/errors";
import SourceChangesetDiff from "../components/SourceChangesetDiff";
import {
  approveSourceChangeset,
  getLibraryViewer,
  getSource,
  getSourceChangesets,
  rejectSourceChangeset,
  type LibrarySource,
  type SourceChangeset,
} from "../libraryApi";
import { canEditSource } from "../libraryRoles";
import LibrarySectionHeader from "../components/LibrarySectionHeader";

/** Source-local changeset history and review queue. */
export default function LibrarySourceProposalsPage() {
  const { sourceId } = useParams();
  const [source, setSource] = useState<LibrarySource | null>(null);
  const [changesets, setChangesets] = useState<SourceChangeset[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<SourceChangeset | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sourceResult, viewer, changesetsResult] = await Promise.all([
        getSource(sourceId),
        getLibraryViewer(),
        getSourceChangesets(sourceId),
      ]);
      if (!sourceResult.ok || !sourceResult.data) {
        throw new Error("Unable to load the source.");
      }
      if (!canEditSource(viewer) || !changesetsResult.ok) {
        throw new Error("Library editor access is required to review changesets.");
      }
      setSource(sourceResult.data);
      setViewerId(viewer?.userId || null);
      setChangesets(changesetsResult.data?.content || []);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (changeset: SourceChangeset) => {
    setBusy(changeset.id);
    try {
      const result = await approveSourceChangeset(
        sourceId,
        changeset.id,
        changeset.version,
      );
      if (!result.ok) throw new Error("Unable to approve the changeset.");
      await load();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusy(rejecting.id);
    try {
      const result = await rejectSourceChangeset(
        sourceId,
        rejecting.id,
        rejecting.version,
        comment.trim(),
      );
      if (!result.ok) throw new Error("Unable to reject the changeset.");
      setRejecting(null);
      setComment("");
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
        rightContent={
          source ? (
            <Link className="btn btn-outline-dark btn-sm" to={`/library/source/${source.id}`}>
              Back to source
            </Link>
          ) : null
        }
      />
      <div className="d-flex justify-content-between align-items-center gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="h3 mb-1">Source changesets</h1>
          {source && <div className="text-muted">{source.name}</div>}
        </div>
        {source && <Link className="btn btn-dark btn-sm" to={`/library/source/${source.id}/edit`}>Edit source</Link>}
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {loading && <Spinner />}
      {!loading && changesets.length === 0 && <div className="tempvs-plain-message text-muted">No changesets for this source.</div>}
      {!loading && changesets.map((changeset) => {
        const own = changeset.proposerId === viewerId;
        const pending = changeset.status === "PENDING";
        return <div key={changeset.id} className="stash-shell p-3 mb-3"><div className="d-flex justify-content-between gap-3 flex-wrap mb-2"><div><Link className="text-reset" to={`/library/source/${sourceId}/changesets/${changeset.id}`}><strong>{changeset.status[0]}{changeset.status.slice(1).toLowerCase()} changeset</strong></Link><div className="small text-muted">Submitted {new Date(changeset.createdAt).toLocaleString()}</div></div><div className="d-flex gap-2 align-items-start">{pending && !own && <><Button size="sm" variant="outline-danger" disabled={busy !== null} onClick={() => setRejecting(changeset)}>Reject</Button><Button size="sm" variant="outline-success" disabled={busy !== null} onClick={() => void approve(changeset)}>Approve</Button></>}</div></div><SourceChangesetDiff compact base={changeset.base} proposed={changeset.proposed} /></div>;
      })}
      <Modal show={Boolean(rejecting)} onHide={() => !busy && setRejecting(null)} centered><Modal.Header closeButton><Modal.Title>Reject changeset</Modal.Title></Modal.Header><Modal.Body><Form.Control as="textarea" rows={4} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="A review comment is required" /></Modal.Body><Modal.Footer><Button variant="outline-secondary" disabled={Boolean(busy)} onClick={() => setRejecting(null)}>Cancel</Button><Button variant="danger" disabled={Boolean(busy) || !comment.trim()} onClick={() => void reject()}>Reject</Button></Modal.Footer></Modal>
    </div>
  );
}
