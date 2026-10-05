import { useCallback, useEffect, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";

import ConfirmationModal from "../../component/ConfirmationModal";
import PageLayout from "../../component/PageLayout";
import Spinner from "../../component/Spinner";
import { getErrorMessage } from "../../util/errors";
import LibraryPeriodBreadcrumb from "../components/LibraryPeriodBreadcrumb";
import SourceChangesetDiff from "../components/SourceChangesetDiff";
import {
  approveSourceChangeset,
  getLibraryViewer,
  getSource,
  getSourceChangeset,
  rejectSourceChangeset,
  type LibrarySource,
  type SourceChangeset,
  withdrawSourceChangeset,
} from "../libraryApi";
import { canEditSource } from "../libraryRoles";

function statusLabel(status: SourceChangeset["status"]) {
  return status.slice(0, 1) + status.slice(1).toLowerCase();
}

/** One private review screen shared by author and Library reviewers. */
export default function LibrarySourceChangesetPage() {
  const { sourceId, changesetId } = useParams();
  const [source, setSource] = useState<LibrarySource | null>(null);
  const [changeset, setChangeset] = useState<SourceChangeset | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sourceResult, viewer, changesetResult] = await Promise.all([
        getSource(sourceId),
        getLibraryViewer(),
        getSourceChangeset(sourceId, changesetId),
      ]);
      if (!sourceResult.ok || !sourceResult.data) throw new Error("Unable to load the source.");
      if (!canEditSource(viewer) || !changesetResult.ok || !changesetResult.data) {
        throw new Error("Library editor access is required to view this changeset.");
      }
      setSource(sourceResult.data);
      setChangeset(changesetResult.data);
      setViewerId(viewer?.userId || null);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [changesetId, sourceId]);

  useEffect(() => { void load(); }, [load]);

  const perform = async (operation: "approve" | "reject" | "withdraw") => {
    if (!changeset) return;
    setBusy(true);
    setError(null);
    try {
      const result = operation === "approve"
        ? await approveSourceChangeset(sourceId, changeset.id, changeset.version, comment.trim() || undefined)
        : operation === "reject"
          ? await rejectSourceChangeset(sourceId, changeset.id, changeset.version, comment.trim())
          : await withdrawSourceChangeset(sourceId, changeset.id, changeset.version);
      if (!result.ok) throw new Error(`Unable to ${operation} this changeset.`);
      setShowReject(false);
      setShowWithdraw(false);
      setComment("");
      await load();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLayout header={{ title: "LIBRARY" }}><Spinner /></PageLayout>;
  if (!source || !changeset) return <PageLayout header={{ title: "LIBRARY" }}><div className="tempvs-plain-message text-danger">{error || "Changeset not found."}</div></PageLayout>;
  const pending = changeset.status === "PENDING";
  const own = changeset.proposerId === viewerId;

  return (
    <PageLayout header={{ title: "SOURCE CHANGESET", backgroundColor: "#f3efe4", borderColor: "#d9ccb0", rightContent: <div className="d-flex align-items-center gap-2"><LibraryPeriodBreadcrumb period={source.period} trailingItem={{ label: source.name, to: `/library/source/${source.id}` }} /><Link to={`/library/source/${source.id}`} className="btn btn-outline-dark btn-sm">Back to source</Link></div> }}>
      <div className="page-layout-content px-4 px-xl-5 pb-4">
        <div className="stash-shell p-3 p-md-4 mx-auto" style={{ maxWidth: "60rem" }}>
          <div className="d-flex justify-content-between gap-3 flex-wrap mb-3"><div><h1 className="h3 mb-1">{source.name}</h1><div className="text-muted small">Submitted {new Date(changeset.createdAt).toLocaleString()}</div></div><span className={`badge align-self-start ${pending ? "text-bg-warning" : "text-bg-secondary"}`}>{statusLabel(changeset.status)}</span></div>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <SourceChangesetDiff base={changeset.base} proposed={changeset.proposed} imageOperations={changeset.imageOperations} />
          {changeset.reviewComment && <div className="border rounded p-3 mt-3 text-start"><div className="fw-semibold">Review comment</div><div>{changeset.reviewComment}</div></div>}
          {pending && <div className="d-flex justify-content-end gap-2 mt-4 flex-wrap">{own ? <><Link to={`/library/source/${source.id}/edit`} className="btn btn-outline-dark">Amend</Link><Button variant="outline-danger" disabled={busy} onClick={() => setShowWithdraw(true)}>Withdraw</Button></> : <><Button variant="outline-danger" disabled={busy} onClick={() => setShowReject(true)}>Reject</Button><Button variant="success" disabled={busy} onClick={() => void perform("approve")}>Approve</Button></>}</div>}
        </div>
      </div>
      <ConfirmationModal show={showWithdraw} title="Withdraw changeset" message="Withdraw this pending source changeset? The published source will remain unchanged." confirmLabel="Withdraw" busy={busy} onHide={() => !busy && setShowWithdraw(false)} onConfirm={() => void perform("withdraw")} />
      <Modal show={showReject} onHide={() => !busy && setShowReject(false)} centered><Modal.Header closeButton><Modal.Title>Reject changeset</Modal.Title></Modal.Header><Modal.Body><p className="text-muted">A review comment is required. The published source will remain unchanged.</p><Form.Control as="textarea" rows={4} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Explain what needs to change" /></Modal.Body><Modal.Footer><Button variant="outline-secondary" disabled={busy} onClick={() => setShowReject(false)}>Cancel</Button><Button variant="danger" disabled={busy || !comment.trim()} onClick={() => void perform("reject")}>Reject changeset</Button></Modal.Footer></Modal>
    </PageLayout>
  );
}
