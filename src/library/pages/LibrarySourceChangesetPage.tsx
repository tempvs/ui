import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Dropdown, Form, Modal } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";

import ConfirmationModal from "../../component/ConfirmationModal";
import PageLayout from "../../component/PageLayout";
import Spinner from "../../component/Spinner";
import CommentThread from "../../comment/CommentThread";
import { formatAppDateTime } from "../../i18n/appLocale";
import { getErrorMessage } from "../../util/errors";
import { getUserProfilesByUserIds } from "../../profile/profileApi";
import { buildProfileLabel } from "../../profile/currentProfile";
import type { Profile } from "../../profile/profileTypes";
import LibraryPeriodBreadcrumb from "../components/LibraryPeriodBreadcrumb";
import SourceChangesetDiff from "../components/SourceChangesetDiff";
import {
  approveSourceChangeset,
  overrideApproveSourceChangeset,
  addSourceProposalTask,
  updateSourceProposalTask,
  publishSourceChangeset,
  getLibraryViewer,
  getSourceChangeset,
  getSourceChangesetImages,
  getSourceImages,
  projectApprovedSourceImages,
  rejectSourceChangeset,
  type LibrarySource,
  type LibrarySourceImage,
  type SourceChangeset,
  withdrawSourceChangeset,
} from "../libraryApi";
import { canEditSource } from "../libraryRoles";
import { getProposalStatusLabel } from "../libraryShared";
import {
  LibraryHint,
  useLibraryProposalEvidence,
} from "../onboarding/LibraryJourney";
import { LibrarySourceEditor } from "./LibrarySourceEditPage";
import "./libraryProposals.css";

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

export default function LibrarySourceChangesetPage() {
  const { sourceId, changesetId } = useParams();
  return (
    <LibrarySourceChangesetReview
      key={changesetId}
      sourceId={sourceId}
      changesetId={changesetId}
    />
  );
}

export function LibrarySourceChangesetReview({
  sourceId,
  changesetId,
  onUpdated,
  onLockChange,
}: {
  sourceId?: string;
  changesetId?: string;
  onUpdated?: (changeset: SourceChangeset) => void;
  onLockChange?: (locked: boolean) => void;
}) {
  const inQueue = Boolean(onUpdated);
  const navigate = useNavigate();
  const [source, setSource] = useState<LibrarySource | null>(null);
  const [changeset, setChangeset] = useState<SourceChangeset | null>(null);
  useLibraryProposalEvidence(changeset);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [actorProfiles, setActorProfiles] = useState<Record<string, Profile>>(
    {},
  );
  const [canOverrideApprovals, setCanOverrideApprovals] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const editButton = useRef<HTMLButtonElement>(null);
  const restoreEditFocus = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedImages, setPublishedImages] = useState<LibrarySourceImage[]>(
    [],
  );
  const [stagedImages, setStagedImages] = useState<LibrarySourceImage[]>([]);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [comment, setComment] = useState("");
  const [taskText, setTaskText] = useState("");
  const [taskBlocking, setTaskBlocking] = useState(true);
  const [overrideAction, setOverrideAction] = useState<
    | { kind: "approve" }
    | { kind: "task"; taskId: string; status: "OPEN" | "RESOLVED" }
    | null
  >(null);
  const [overrideReason, setOverrideReason] = useState("");

  useEffect(() => {
    onLockChange?.(editing || busy);
  }, [busy, editing, onLockChange]);

  useEffect(() => {
    if (!editing && !busy && !loading && restoreEditFocus.current) {
      restoreEditFocus.current = false;
      editButton.current?.focus();
    }
  }, [busy, editing, loading]);

  const load = useCallback(async (updated?: SourceChangeset, notify = false) => {
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
      const current = updated && updated.version >= detail.changeset.version ? updated : detail.changeset;
      setChangeset(current);
      setViewerId(viewer?.userId || null);
      setCanOverrideApprovals(
        Boolean(
          viewer?.roles?.some(
            (role) => role === "TEMPVS_ADMIN" || role === "LIBRARY_ADMIN",
          ),
        ),
      );
      const actorIds = Array.from(
        new Set([
          current.proposerId,
          ...(current.approvals || []).map(
            (approval) => approval.userId,
          ),
          ...(current.amendments || []).map(
            (amendment) => amendment.userId,
          ),
          ...(current.publishedBy
            ? [current.publishedBy]
            : []),
          ...(current.tasks || []).flatMap((task) =>
            [task.createdBy, task.resolvedBy, task.reopenedBy].filter(
              (id): id is string => Boolean(id),
            ),
          ),
        ]),
      );
      const [published, staged, profiles] = await Promise.all([
        getSourceImages(detail.source.id).catch(() => null),
        getSourceChangesetImages(detail.source.id, detail.changeset.id).catch(
          () => null,
        ),
        getUserProfilesByUserIds(actorIds).catch(() => []),
      ]);
      setActorProfiles(
        Object.fromEntries(
          profiles.map((profile) => [String(profile.userId), profile]),
        ),
      );
      setPublishedImages(published?.data || []);
      setStagedImages(staged?.data || []);
      if (notify) onUpdated?.(current);
    } catch (caught) {
      if (updated) onUpdated?.(updated);
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [changesetId, onUpdated, sourceId]);

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
    let timeout: number | undefined;
    const refresh = async () => {
      const result = await getSourceChangesetImages(source.id, changeset.id).catch(() => null);
      if (!active || !result?.ok) return;
      setStagedImages(result.data || []);
      const ready = stagedIds.every((id) =>
        result.data?.some(
          (image) =>
            image.id === id && Boolean(image.thumbnailUrl || image.url),
        ),
      );
      attempts += 1;
      if (!ready && attempts < 10) timeout = window.setTimeout(refresh, 1000);
    };
    void refresh();
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [changeset, source]);

  const perform = async (
    operation: "approve" | "override" | "publish" | "reject" | "withdraw",
    reason?: string,
  ) => {
    if (!changeset) return;
    setBusy(true);
    setError(null);
    setNotice("");
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
                reason,
              )
            : operation === "publish"
              ? await publishSourceChangeset(
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
      if (!result.ok) throw responseError(result, `Unable to ${operation} this changeset.`);
      const updated = result.data && (
        "changeset" in result.data ? result.data.changeset :
        "proposed" in result.data ? result.data : undefined
      );
      setShowReject(false);
      setOverrideAction(null);
      setOverrideReason("");
      setShowWithdraw(false);
      setComment("");
      if (operation === "publish") {
        if (inQueue) {
          const published = updated || { ...changeset, status: "APPLIED" as const };
          setChangeset(published);
          onUpdated?.(published);
          setNotice("Proposal published to the Library.");
          return;
        }
        const approvedSource =
          result.data &&
          typeof result.data === "object" &&
          "source" in result.data
            ? result.data.source
            : undefined;
        const approvedImages =
          approvedSource && changeset
            ? projectApprovedSourceImages(
                publishedImages,
                changeset,
                stagedImages,
              )
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
            state: approvedSource
              ? {
                  approvedSource,
                  approvedImages,
                  publishedImagesBeforeApproval: publishedImages,
                  approvedImageOperations: changeset.imageOperations,
                }
              : undefined,
          },
        );
        return;
      }
      if (updated) setChangeset(updated);
      await load(updated ?? undefined, true);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const saveTask = async (
    taskId?: string,
    status?: "OPEN" | "RESOLVED",
    adminOverride = false,
    reason?: string,
  ) => {
    if (!source || !changeset) return;
    setBusy(true);
    setError(null);
    try {
      const result =
        taskId && status
          ? adminOverride
            ? await updateSourceProposalTask(
                source.id,
                changeset.id,
                taskId,
                changeset.version,
                status,
                true,
                reason,
              )
            : await updateSourceProposalTask(
                source.id,
                changeset.id,
                taskId,
                changeset.version,
                status,
              )
          : await addSourceProposalTask(
              source.id,
              changeset.id,
              changeset.version,
              taskText.trim(),
              taskBlocking,
            );
      if (!result.ok)
        throw responseError(
          result,
          "Unable to save the task. Reload the proposal and try again.",
        );
      if (!taskId) setTaskText("");
      setOverrideAction(null);
      setOverrideReason("");
      await load(result.data && "proposed" in result.data ? result.data : undefined, true);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (!source || !changeset) {
    const message = loading ? <Spinner /> : (
      <div className="tempvs-plain-message text-danger" role="alert">
        {error || "Changeset not found."}
      </div>
    );
    return inQueue ? message : <PageLayout header={{ title: "LIBRARY" }}>{message}</PageLayout>;
  }
  const pending = changeset.status === "PENDING";
  const userProfileLink = (userId: string) => {
    const profile = actorProfiles[userId];
    return (
      <Link
        to={
          profile
            ? `/profile/${profile.alias || profile.id}`
            : `/profile/user/${userId}`
        }
      >
        {buildProfileLabel(profile, "User profile")}
      </Link>
    );
  };
  const approved = changeset.status === "APPROVED";
  const unpublished = pending || approved;
  const blockingTasks = (changeset.tasks || []).filter(
    (task) => task.blocking && task.status === "OPEN",
  );
  const proposalPath = `/library/source/${source.id}/changesets/${changeset.id}`;
  const own = changeset.proposerId === viewerId;
  const contributor =
    own ||
    changeset.amendments?.some((amendment) => amendment.userId === viewerId);
  const canEdit = unpublished && changeset.kind !== "DELETE";
  const canApprove = pending && !contributor;
  const Title = inQueue ? "h2" : "h1";
  const header = {
    title: (
      <LibraryPeriodBreadcrumb
        period={source.period}
        trailingItem={{
          label: source.name,
          to:
            changeset.kind === "CREATE" && changeset.status !== "APPLIED"
              ? proposalPath
              : `/library/source/${source.id}`,
        }}
        trailingItems={[{ label: "Proposal", to: proposalPath }]}
      />
    ),
    backgroundColor: "#f3efe4",
    borderColor: "#d9ccb0",
  };
  const finishEditing = () => {
    restoreEditFocus.current = true;
    setEditing(false);
  };
  const content = (
    <>
      <div
        className={inQueue ? "proposal-review" : "proposal-review stash-shell p-3 p-md-4 mx-auto"}
        style={inQueue ? undefined : { maxWidth: "60rem" }}
      >
        <header className="proposal-review-header">
          <div>
            <Title className="h3 mb-1">{changeset.proposed.name || source.name}</Title>
            <div className="text-muted small">
              Revision {changeset.revision ?? changeset.version}
              {" · "}Submitted {formatAppDateTime(changeset.createdAt)}
            </div>
          </div>
          <span
            className="proposal-status"
            data-status={changeset.status}
          >
            {getProposalStatusLabel(changeset.status)}
          </span>
        </header>
        {notice && <p className="text-success mt-3" role="status">{notice}</p>}
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {editing ? (
          <LibrarySourceEditor
            sourceId={source.id}
            inline={{
              source,
              changeset,
              publishedImages,
              stagedImages,
              canRebase: own,
              onCancel: finishEditing,
              onSaved: (updated) => {
                setChangeset(updated);
                setBusy(true);
                finishEditing();
                setNotice("Revision saved and awaiting independent review.");
                void load(updated, true).finally(() => setBusy(false));
              },
            }}
          />
        ) : (
          <>
            <div className="proposal-changes-heading">
              <h3 className="h5 mb-0">Changes</h3>
              {canEdit && (
                <Button
                  type="button"
                  ref={editButton}
                  variant="outline-dark"
                  size="sm"
                  disabled={busy || loading}
                  onClick={() => {
                    setError(null);
                    setNotice("");
                    setEditing(true);
                  }}
                >
                  Edit proposal
                </Button>
              )}
            </div>
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
            <section
              className="border rounded p-3 mt-3 text-start"
              aria-labelledby="proposal-tasks-title"
            >
              <h2 id="proposal-tasks-title" className="h5">
                Action items
              </h2>
              {!(changeset.tasks || []).length && (
                <p className="text-muted">No action items yet.</p>
              )}
              <ul className="list-unstyled">
                {(changeset.tasks || []).map((task) => (
                  <li key={task.id} className="border-bottom py-2">
                    <div className="d-flex justify-content-between gap-2 align-items-start">
                      <div>
                        <span
                          className={`badge me-2 ${task.status === "RESOLVED" ? "text-bg-success" : task.blocking ? "text-bg-danger" : "text-bg-secondary"}`}
                        >
                          {task.status === "RESOLVED"
                            ? "Resolved"
                            : task.blocking
                              ? "Blocking"
                              : "Suggestion"}
                        </span>
                        <span
                          style={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {task.text}
                        </span>
                        <div className="small text-muted mt-1">
                          Added by {userProfileLink(task.createdBy)} on{" "}
                          {formatAppDateTime(task.createdAt)}
                        </div>
                        {task.status === "RESOLVED" && task.resolvedBy && (
                          <div className="small">
                            Resolved by {userProfileLink(task.resolvedBy)}
                            {task.resolutionOverrideReason
                              ? ` (Admin override: ${task.resolutionOverrideReason})`
                              : ""}
                          </div>
                        )}
                        {task.status === "OPEN" && task.reopenedBy && (
                          <div className="small">
                            Reopened by {userProfileLink(task.reopenedBy)}
                            {task.reopenOverrideReason
                              ? ` (Admin override: ${task.reopenOverrideReason})`
                              : ""}
                          </div>
                        )}
                      </div>
                      {unpublished &&
                        (task.createdBy === viewerId || canOverrideApprovals) && (
                          <Button
                            size="sm"
                            variant={
                              task.createdBy === viewerId
                                ? "outline-dark"
                                : "warning"
                            }
                            disabled={busy}
                            onClick={() =>
                              task.createdBy === viewerId
                                ? void saveTask(
                                    task.id,
                                    task.status === "OPEN" ? "RESOLVED" : "OPEN",
                                  )
                                : setOverrideAction({
                                    kind: "task",
                                    taskId: task.id,
                                    status:
                                      task.status === "OPEN"
                                        ? "RESOLVED"
                                        : "OPEN",
                                  })
                            }
                          >
                            {task.createdBy !== viewerId
                              ? task.status === "OPEN"
                                ? "Admin override: resolve task"
                                : "Admin override: reopen task"
                              : task.status === "OPEN"
                                ? "Resolve task"
                                : "Reopen task"}
                          </Button>
                        )}
                    </div>
                  </li>
                ))}
              </ul>
              {unpublished && (
                <Form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (taskText.trim()) void saveTask();
                  }}
                >
                  <Form.Label htmlFor="proposal-task-text">
                    New action item
                  </Form.Label>
                  <LibraryHint
                    topic="tasks"
                    priority={20}
                    enabled={!overrideAction && !showReject && !showWithdraw}
                    message="Add a concrete action item if a change needs work. The author amends and replies; the task creator verifies the fix. Blocking tasks stop approval and publication."
                    className="library-hint-block"
                  >
                    <Form.Control
                      id="proposal-task-text"
                      as="textarea"
                      rows={2}
                      maxLength={2000}
                      value={taskText}
                      onChange={(event) => setTaskText(event.target.value)}
                      placeholder="For example: provide a source for this date"
                      disabled={busy}
                    />
                  </LibraryHint>
                  <Form.Check
                    className="my-2"
                    id="proposal-task-blocking"
                    label="Block approval and publication until resolved"
                    checked={taskBlocking}
                    onChange={(event) => setTaskBlocking(event.target.checked)}
                    disabled={busy}
                  />
                  <p className="small text-muted">
                    The task creator or an admin can resolve or reopen a task.
                    Discuss fixes in the proposal comments below.
                  </p>
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline-dark"
                    disabled={
                      busy ||
                      !taskText.trim() ||
                      (changeset.tasks?.length ?? 0) >= 50
                    }
                  >
                    Add task
                  </Button>
                </Form>
              )}
            </section>
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
            <div className="mt-3 text-start small">
              <div>Proposed by {userProfileLink(changeset.proposerId)}</div>
              {(changeset.amendments || []).map((amendment, index) => (
                <div key={`amendment-${index}`}>
                  Revision {amendment.revision} amended by{" "}
                  {userProfileLink(amendment.userId)} on{" "}
                  {formatAppDateTime(amendment.amendedAt)}
                </div>
              ))}
              {(changeset.approvals || []).map((approval, index) => (
                <div key={index}>
                  {approval.adminOverride
                    ? "Approved by admin override by "
                    : "Approved by "}
                  {userProfileLink(approval.userId)} on{" "}
                  {formatAppDateTime(approval.approvedAt)}
                  {approval.adminOverride && approval.comment
                    ? ` — ${approval.comment}`
                    : ""}
                  {approval.revision !== (changeset.revision ?? changeset.version)
                    ? " (earlier revision)"
                    : ""}
                </div>
              ))}
              {changeset.publishedBy && (
                <div>
                  {changeset.publicationAdminOverride
                    ? "Published using admin override by "
                    : "Published by "}
                  {userProfileLink(changeset.publishedBy)} on{" "}
                  {formatAppDateTime(changeset.publishedAt!)}
                  {changeset.publicationReason
                    ? ` — ${changeset.publicationReason}`
                    : ""}
                </div>
              )}
            </div>
            {approved && !own && canOverrideApprovals && (
              <Form.Group className="mt-3" controlId="proposal-publish-override">
                <Form.Label>Reason for publishing on behalf</Form.Label>
                <Form.Control
                  as="textarea"
                  aria-label="Reason for publishing on behalf"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  disabled={busy}
                />
              </Form.Group>
            )}
            <footer className="proposal-decision">
              <div className="proposal-decision-copy small">
                {blockingTasks.length > 0 && unpublished ? (
                  <p className="text-danger mb-0" role="status">
                    Blocked until {blockingTasks.length} action item
                    {blockingTasks.length === 1 ? " is" : "s are"} resolved.
                  </p>
                ) : approved ? (
                  <p className="text-muted mb-0">
                    {own ? "Publishing makes this revision public." : "The author can now publish this revision."}
                  </p>
                ) : pending ? (
                  <p className="text-muted mb-0">
                    {contributor
                      ? "This revision needs an independent reviewer."
                      : "Approval sends this revision to the author for publication."}
                  </p>
                ) : changeset.status === "APPLIED" && changeset.kind !== "DELETE" ? (
                  <Link to={`/library/source/${source.id}`}>View published source</Link>
                ) : null}
              </div>
              {pending && (own || canApprove) && (
                <Dropdown align="end">
                  <Dropdown.Toggle variant="outline-secondary" size="sm" disabled={busy || loading}>
                    More actions
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    {own ? (
                      <Dropdown.Item as="button" onClick={() => setShowWithdraw(true)}>Withdraw</Dropdown.Item>
                    ) : (
                      <Dropdown.Item as="button" onClick={() => setShowReject(true)}>Reject</Dropdown.Item>
                    )}
                  </Dropdown.Menu>
                </Dropdown>
              )}
              {pending && canOverrideApprovals && (
                <Button
                  variant="warning"
                  size="sm"
                  disabled={busy || loading || blockingTasks.length > 0}
                  onClick={() => setOverrideAction({ kind: "approve" })}
                >
                  Admin override: approve proposal
                </Button>
              )}
              {canApprove && (
                <LibraryHint
                  topic="review"
                  priority={10}
                  enabled={blockingTasks.length === 0 && !overrideAction && !showReject && !showWithdraw}
                  message="Check the changes, images, comments, and tasks first. The author can publish after you approve."
                >
                  <Button
                    variant="dark"
                    disabled={busy || loading || blockingTasks.length > 0}
                    onClick={() => void perform("approve")}
                  >
                    Approve
                  </Button>
                </LibraryHint>
              )}
              {approved && (own || canOverrideApprovals) && (
                <LibraryHint
                  topic="publish"
                  priority={5}
                  enabled={own && blockingTasks.length === 0 && !overrideAction && !showReject && !showWithdraw}
                  message="Approval is complete. Publish makes this revision visible in the public Library."
                >
                  <Button
                    variant={own ? "dark" : "warning"}
                    disabled={busy || loading || blockingTasks.length > 0 || (!own && !comment.trim())}
                    onClick={() => void perform("publish")}
                  >
                    {own ? "Publish" : "Admin override: publish on author's behalf"}
                  </Button>
                </LibraryHint>
              )}
            </footer>
          </>
        )}
      </div>
      <Modal
        show={Boolean(overrideAction)}
        onHide={() => {
          if (!busy) {
            setOverrideAction(null);
            setOverrideReason("");
            setError(null);
          }
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Admin override</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            {overrideAction?.kind === "approve"
              ? "Approve this revision using administrator privileges, including your own proposal. This does not publish it or bypass unresolved blockers."
              : "Use administrator privileges to change a task created by another reviewer."}{" "}
            Your identity and reason will be recorded.
          </p>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <Form.Label htmlFor="admin-override-reason">
            Reason for admin override
          </Form.Label>
          <Form.Control
            id="admin-override-reason"
            as="textarea"
            rows={3}
            maxLength={10000}
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            disabled={busy}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={busy}
            onClick={() => {
              setOverrideAction(null);
              setOverrideReason("");
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="warning"
            disabled={busy || !overrideReason.trim()}
            onClick={() => {
              if (overrideAction?.kind === "approve")
                void perform("override", overrideReason.trim());
              else if (overrideAction?.kind === "task")
                void saveTask(
                  overrideAction.taskId,
                  overrideAction.status,
                  true,
                  overrideReason.trim(),
                );
            }}
          >
            Confirm admin override
          </Button>
        </Modal.Footer>
      </Modal>
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
    </>
  );
  return inQueue ? content : <PageLayout header={header}>{content}</PageLayout>;
}
