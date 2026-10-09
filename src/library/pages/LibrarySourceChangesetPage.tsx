import { useCallback, useEffect, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";

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
      const [sourceResult, viewer, changesetResult] = await Promise.all([
        getSource(sourceId),
        getLibraryViewer(),
        getSourceChangeset(sourceId, changesetId),
      ]);
      if (!sourceResult.ok || !sourceResult.data)
        throw new Error("Unable to load the source.");
      if (!canEditSource(viewer))
        throw new Error(
          "Library editor access is required to view this changeset.",
        );
      if (!changesetResult.ok || !changesetResult.data)
        throw responseError(changesetResult, "Unable to load this changeset.");
      setSource(sourceResult.data);
      setChangeset(changesetResult.data);
      setViewerId(viewer?.userId || null);
      const [published, staged] = await Promise.all([
        getSourceImages(sourceResult.data.id).catch(() => null),
        getSourceChangesetImages(
          sourceResult.data.id,
          changesetResult.data.id,
        ).catch(() => null),
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

  const perform = async (operation: "approve" | "reject" | "withdraw") => {
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
      if (operation === "approve") {
        navigate(
          changeset.kind === "DELETE"
            ? source?.period
              ? `/library/period/${source.period.toLowerCase()}`
              : "/library"
            : `/library/source/${sourceId}`,
          { replace: true },
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
  const publishedById = new Map(
    publishedImages.map((image) => [image.id, image]),
  );
  const stagedById = new Map(stagedImages.map((image) => [image.id, image]));

  return (
    <PageLayout
      header={{
        title: "SOURCE CHANGESET",
        backgroundColor: "#f3efe4",
        borderColor: "#d9ccb0",
        rightContent: (
          <LibraryPeriodBreadcrumb
            period={source.period}
            trailingItem={{
              label: source.name,
              to: `/library/source/${source.id}`,
            }}
          />
        ),
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
          />
          {changeset.imageOperations.length > 0 && (
            <section className="mt-4">
              <h2 className="h5">Image changes</h2>
              <div className="row g-3">
                {changeset.imageOperations.map((operation) => {
                  const image =
                    operation.kind === "ADD" || operation.kind === "REPLACE"
                      ? stagedById.get(operation.stagedImageId)
                      : publishedById.get(operation.imageId);
                  const prior =
                    operation.kind === "REPLACE" || operation.kind === "REMOVE"
                      ? publishedById.get(operation.imageId)
                      : null;
                  return (
                    <div
                      className="col-md-6"
                      key={
                        operation.kind === "ADD"
                          ? operation.stagedImageId
                          : `${operation.kind}-${operation.imageId}`
                      }
                    >
                      <div className="border rounded p-2 h-100">
                        <div className="small fw-semibold mb-2">
                          {operation.kind === "ADD"
                            ? "Added"
                            : operation.kind === "REMOVE"
                              ? "Removed"
                              : operation.kind === "REPLACE"
                                ? "Replaced"
                                : "Description changed"}
                        </div>
                        {prior && (
                          <ImagePreview
                            image={prior}
                            className="source-changeset-image-removed"
                            label="Previous image"
                          />
                        )}
                        {image && (
                          <ImagePreview
                            image={image}
                            className={
                              operation.kind === "REMOVE"
                                ? "source-changeset-image-removed"
                                : "source-changeset-image-added"
                            }
                            label={
                              operation.kind === "REMOVE"
                                ? "Removed image"
                                : "Proposed image"
                            }
                          />
                        )}
                        {!image && operation.kind !== "REMOVE" && (
                          <div className="small text-muted">
                            Image upload is still processing.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
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

function ImagePreview({
  image,
  className,
  label,
}: {
  image: LibrarySourceImage;
  className: string;
  label: string;
}) {
  return (
    <div className={`${className} p-2 rounded mb-2`}>
      <div className="small fw-semibold">{label}</div>
      {image.thumbnailUrl || image.url ? (
        <img
          src={image.thumbnailUrl || image.url || undefined}
          alt={image.description || label}
          className="img-fluid rounded mt-1"
          style={{ maxHeight: "10rem" }}
        />
      ) : (
        <div className="small text-muted mt-1">{image.fileName || "Image"}</div>
      )}
      <div className="small mt-1">{image.description || "No description"}</div>
    </div>
  );
}
