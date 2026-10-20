import { useCallback, useEffect, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";

import ConfirmationModal from "../../component/ConfirmationModal";
import PageLayout from "../../component/PageLayout";
import Spinner from "../../component/Spinner";
import CommentThread from "../../comment/CommentThread";
import { getErrorMessage } from "../../util/errors";
import LibraryPeriodBreadcrumb from "../components/LibraryPeriodBreadcrumb";
import SourceChangesetDiff from "../components/SourceChangesetDiff";
import {
  approveSourceChangeset,
  overrideApproveSourceChangeset,
  getLibraryViewer,
  getSourceChangeset,
  getSourceChangesetImages,
  getSourceImages,
  rejectSourceChangeset,
  type LibrarySource,
  type LibrarySourceImage,
  type SourceChangeset,
  withdrawSourceChangeset,
} from "../libraryApi";
import { canEditSource } from "../libraryRoles";

function responseError(
  response: { status: number; data: unknown },
  fallback: string,
): Error {
  const message =
    response.data &&
    typeof response.data === "object" &&
    "message" in response.data &&
    typeof response.data.message === "string"
      ? response.data.message
      : fallback;
  return new Error(message);
}

function statusLabel(status: SourceChangeset["status"]) {
  return status.slice(0, 1) + status.slice(1).toLowerCase();
}

/** One private review screen shared by author and Library reviewers. */
export default function LibrarySourceChangesetPage() {
  const { sourceId, changesetId } = useParams();
  const navigate = useNavigate();
  const [source, setSource] = useState<LibrarySource | null>(null);
  const [changeset, setChangeset] = useState<SourceChangeset | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [canOverrideApprovals, setCanOverrideApprovals] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedImages, setPublishedImages] = useState<LibrarySourceImage[]>(
    [],
  );
  const [stagedImages, setStagedImages] = useState<LibrarySourceImage[]>([]);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [viewer, changesetResult] = await Promise.all([
        getLibraryViewer(),
        getSourceChangeset(sourceId, changesetId),
      ]);
      if (!canEditSource(viewer))
        throw new Error(
          "Library editor access is required to view this changeset.",
        );
      if (!changesetResult.ok || !changesetResult.data)
        throw responseError(changesetResult, "Unable to load this changeset.");
      const detail = changesetResult.data;
      if (!("source" in detail) || !("changeset" in detail))
        throw new Error("Unable to load this changeset.");
      setSource(detail.source);
      setChangeset(detail.changeset);
      setViewerId(viewer?.userId || null);
      setCanOverrideApprovals(Boolean(viewer?.roles?.includes("TEMPVS_ADMIN")));
      const [published, staged] = await Promise.all([
        getSourceImages(detail.source.id).catch(() => null),
        getSourceChangesetImages(detail.source.id, detail.changeset.id).catch(
          () => null,
        ),
      ]);
      setPublishedImages(published?.data || []);
      setStagedImages(staged?.data || []);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [changesetId, sourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Source image processing is asynchronous. A reviewer commonly opens the
  // proposal immediately after it is submitted, before S3 processing has
  // produced the signed thumbnail. Refresh the private staged records briefly
  // so the proposal shows the actual image rather than a permanent placeholder.
  useEffect(() => {
    if (!source || !changeset) return;
    const stagedIds = changeset.imageOperations.flatMap((operation) =>
      operation.kind === "ADD" || operation.kind === "REPLACE"
        ? [operation.stagedImageId]
        : [],
    );
    if (!stagedIds.length) return;
    let active = true;
    let attempts = 0;
    const refresh = async () => {
      const result = await getSourceChangesetImages(source.id, changeset.id);
      if (!active || !result.ok) return;
      setStagedImages(result.data || []);
      const ready = stagedIds.every((id) =>
        result.data?.some(
          (image) =>
            image.id === id && Boolean(image.thumbnailUrl || image.url),
        ),
      );
      attempts += 1;
      if (!ready && attempts < 10 && active) window.setTimeout(refresh, 1000);
    };
    void refresh();
    return () => {
      active = false;
    };
  }, [changeset, source]);

  const perform = async (
    operation: "approve" | "override" | "reject" | "withdraw",
  ) => {
    if (!changeset) return;
    setBusy(true);
    setError(null);
    try {
      const result =
        operation === "approve"
          ? await approveSourceChangeset(
              sourceId,
              changeset.id,
              changeset.version,
              comment.trim() || undefined,
            )
          : operation === "override"
            ? await overrideApproveSourceChangeset(
                sourceId,
                changeset.id,
                changeset.version,
                comment.trim() || undefined,
              )
            : operation === "reject"
              ? await rejectSourceChangeset(
                  sourceId,
                  changeset.id,
                  changeset.version,
                  comment.trim(),
                )
              : await withdrawSourceChangeset(
                  sourceId,
                  changeset.id,
                  changeset.version,
                );
      if (!result.ok) throw new Error(`Unable to ${operation} this changeset.`);
      setShowReject(false);
      setShowWithdraw(false);
      setComment("");
      if (operation === "approve" || operation === "override") {
        const approvedSource =
          result.data &&
          typeof result.data === "object" &&
          "source" in result.data
            ? result.data.source
            : undefined;
        navigate(
          changeset.kind === "DELETE"
            ? source?.period
              ? `/library/period/${source.period.toLowerCase()}`
              : "/library"
            : `/library/source/${sourceId}`,
          {
            replace: true,
            // Preserve the approved source in the client during the route
            // transition. The source page refreshes related data in the
            // background, rather than flashing an empty page and spinner.
            state: approvedSource ? { approvedSource } : undefined,
          },
        );
        return;
      }
      await load();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <PageLayout header={{ title: "LIBRARY" }}>
        <Spinner />
      </PageLayout>
    );
  if (!source || !changeset)
    return (
      <PageLayout header={{ title: "LIBRARY" }}>
        <div className="tempvs-plain-message text-danger">
          {error || "Changeset not found."}
        </div>
      </PageLayout>
    );
  const pending = changeset.status === "PENDING";
  const own = changeset.proposerId === viewerId;
  return (
    <PageLayout
      header={{
        title: (
          <LibraryPeriodBreadcrumb
            period={source.period}
            trailingItem={{
              label: source.name,
              to: `/library/source/${source.id}`,
            }}
          />
        ),
        backgroundColor: "#f3efe4",
        borderColor: "#d9ccb0",
      }}
    >
      <div className="page-layout-content px-4 px-xl-5 pb-4">
        <div
          className="stash-shell p-3 p-md-4 mx-auto"
          style={{ maxWidth: "60rem" }}
        >
          <div className="d-flex justify-content-between gap-3 flex-wrap mb-3">
            <div>
              <h1 className="h3 mb-1">{source.name}</h1>
              <div className="text-muted small">
                Submitted {new Date(changeset.createdAt).toLocaleString()}
              </div>
            </div>
            <span
              className={`badge align-self-start ${pending ? "text-bg-warning" : "text-bg-secondary"}`}
            >
              {statusLabel(changeset.status)}
            </span>
          </div>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <SourceChangesetDiff
            base={changeset.base}
            proposed={changeset.proposed}
            kind={changeset.kind}
            imageOperations={changeset.imageOperations}
            imagePreviews={{
              published: publishedImages,
              staged: stagedImages,
            }}
          />
          <CommentThread
            targetType="SOURCE_CHANGESET"
            targetId={`${source.id}:${changeset.id}`}
          />
          {changeset.reviewComment && (
            <div className="border rounded p-3 mt-3 text-start">
              <div className="fw-semibold">Review comment</div>
              <div>{changeset.reviewComment}</div>
            </div>
          )}
          {pending && (
            <div className="d-flex justify-content-end gap-2 mt-4 flex-wrap">
              {own ? (
                <>
                  {changeset.kind !== "DELETE" && (
                    <Link
                      to={`/library/source/${source.id}/edit`}
                      className="btn btn-outline-dark"
                    >
                      Amend
                    </Link>
                  )}
                  <Button
                    variant="outline-danger"
                    disabled={busy}
                    onClick={() => setShowWithdraw(true)}
                  >
                    Withdraw
                  </Button>
                  {canOverrideApprovals && (
                    <Button
                      variant="warning"
                      disabled={busy}
                      onClick={() => void perform("override")}
                    >
                      Approve as Tempvs Admin
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    variant="outline-danger"
                    disabled={busy}
                    onClick={() => setShowReject(true)}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="success"
                    disabled={busy}
                    onClick={() => void perform("approve")}
                  >
                    Approve
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <ConfirmationModal
        show={showWithdraw}
        title="Withdraw changeset"
        message="Withdraw this pending source changeset? The published source will remain unchanged."
        confirmLabel="Withdraw"
        busy={busy}
        onHide={() => !busy && setShowWithdraw(false)}
        onConfirm={() => void perform("withdraw")}
      />
      <Modal
        show={showReject}
        onHide={() => !busy && setShowReject(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Reject changeset</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted">
            A review comment is required. The published source will remain
            unchanged.
          </p>
          <Form.Control
            as="textarea"
            rows={4}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Explain what needs to change"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={busy}
            onClick={() => setShowReject(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy || !comment.trim()}
            onClick={() => void perform("reject")}
          >
            Reject changeset
          </Button>
        </Modal.Footer>
      </Modal>
    </PageLayout>
  );
}
