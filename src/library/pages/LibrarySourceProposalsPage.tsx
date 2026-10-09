import { useCallback, useEffect, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";

import Spinner from "../../component/Spinner";
import { getErrorMessage } from "../../util/errors";
import SourceChangesetProposalCard from "../components/SourceChangesetProposalCard";
import LibraryPeriodBreadcrumb from "../components/LibraryPeriodBreadcrumb";
import {
  approveSourceChangeset,
  getLibraryViewer,
  getSource,
  getSourceChangesets,
  getSourceChangesetImages,
  getSourceImages,
  rejectSourceChangeset,
  type LibrarySource,
  type LibrarySourceImage,
  type SourceChangeset,
} from "../libraryApi";
import { canEditSource } from "../libraryRoles";
import LibrarySectionHeader from "../components/LibrarySectionHeader";

const PROPOSALS_PAGE_SIZE = 20;

/** Source-local changeset history and review queue. */
export default function LibrarySourceProposalsPage() {
  const { sourceId } = useParams();
  const navigate = useNavigate();
  const [source, setSource] = useState<LibrarySource | null>(null);
  const [changesets, setChangesets] = useState<SourceChangeset[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [publishedImages, setPublishedImages] = useState<LibrarySourceImage[]>(
    [],
  );
  const [stagedImagesByChangeset, setStagedImagesByChangeset] = useState<
    Record<string, LibrarySourceImage[]>
  >({});
  const [expandedChangesetIds, setExpandedChangesetIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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
        getSourceChangesets(sourceId, undefined, PROPOSALS_PAGE_SIZE),
      ]);
      if (!sourceResult.ok || !sourceResult.data) {
        throw new Error("Unable to load the source.");
      }
      if (!canEditSource(viewer) || !changesetsResult.ok) {
        throw new Error(
          "Library editor access is required to review changesets.",
        );
      }
      setSource(sourceResult.data);
      setViewerId(viewer?.userId || null);
      const loadedSourceId = sourceResult.data.id;
      const content = changesetsResult.data?.content || [];
      setChangesets(content);
      setNextToken(changesetsResult.data?.nextToken || null);
      setExpandedChangesetIds(new Set());
      const changesetsWithStagedImages = content.filter((changeset) =>
        changeset.imageOperations.some(
          (operation) =>
            operation.kind === "ADD" || operation.kind === "REPLACE",
        ),
      );
      const [published, stagedEntries] = await Promise.all([
        getSourceImages(loadedSourceId).catch(() => null),
        Promise.all(
          changesetsWithStagedImages.map(async (changeset) => {
            const staged = await getSourceChangesetImages(
              loadedSourceId,
              changeset.id,
            ).catch(() => null);
            return [changeset.id, staged?.data || []] as const;
          }),
        ),
      ]);
      setPublishedImages(published?.data || []);
      setStagedImagesByChangeset(Object.fromEntries(stagedEntries));
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
      navigate(
        changeset.kind === "DELETE"
          ? source?.period
            ? `/library/period/${source.period.toLowerCase()}`
            : "/library"
          : `/library/source/${sourceId}`,
        { replace: true },
      );
      return;
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

  const toggleChangeset = (changesetId: string) => {
    setExpandedChangesetIds((current) => {
      const next = new Set(current);
      if (next.has(changesetId)) next.delete(changesetId);
      else next.add(changesetId);
      return next;
    });
  };

  const loadMore = async () => {
    if (!sourceId || !nextToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await getSourceChangesets(
        sourceId,
        nextToken,
        PROPOSALS_PAGE_SIZE,
      );
      if (!result.ok) throw new Error("Unable to load more changesets.");
      const additional = result.data?.content || [];
      const stagedEntries = await Promise.all(
        additional
          .filter((changeset) =>
            changeset.imageOperations.some(
              (operation) =>
                operation.kind === "ADD" || operation.kind === "REPLACE",
            ),
          )
          .map(async (changeset) => {
            const staged = await getSourceChangesetImages(
              sourceId,
              changeset.id,
            ).catch(() => null);
            return [changeset.id, staged?.data || []] as const;
          }),
      );
      setChangesets((current) => [...current, ...additional]);
      setNextToken(result.data?.nextToken || null);
      setStagedImagesByChangeset((current) => ({
        ...current,
        ...Object.fromEntries(stagedEntries),
      }));
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="page-layout-content px-4 px-xl-5 pb-4">
      <LibrarySectionHeader
        title="LIBRARY"
        subtitle={null}
        rightContent={
          source ? (
            <LibraryPeriodBreadcrumb
              period={source.period}
              variant="source"
              trailingItem={{
                label: source.name,
                to: `/library/source/${source.id}`,
              }}
            />
          ) : null
        }
      />
      <div className="d-flex justify-content-between align-items-center gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="h3 mb-1">Source changesets</h1>
          {source && <div className="text-muted">{source.name}</div>}
        </div>
        {source && (
          <Link
            className="btn btn-dark btn-sm"
            to={`/library/source/${source.id}/edit`}
          >
            Edit source
          </Link>
        )}
      </div>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {loading && <Spinner />}
      {!loading && changesets.length === 0 && (
        <div className="tempvs-plain-message text-muted">
          No changesets for this source.
        </div>
      )}
      {!loading &&
        changesets.map((changeset) => {
          const own = changeset.proposerId === viewerId;
          const pending = changeset.status === "PENDING";
          return (
            <SourceChangesetProposalCard
              key={changeset.id}
              source={source!}
              changeset={changeset}
              showSource={false}
              expanded={expandedChangesetIds.has(changeset.id)}
              onToggle={() => toggleChangeset(changeset.id)}
              imagePreviews={{
                published: publishedImages,
                staged: stagedImagesByChangeset[changeset.id] || [],
              }}
              actions={
                pending && !own ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      disabled={busy !== null}
                      onClick={() => setRejecting(changeset)}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-success"
                      disabled={busy !== null}
                      onClick={() => void approve(changeset)}
                    >
                      Approve
                    </Button>
                  </>
                ) : null
              }
            />
          );
        })}
      {nextToken && (
        <Button
          variant="outline-dark"
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
      <Modal
        show={Boolean(rejecting)}
        onHide={() => !busy && setRejecting(null)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Reject changeset</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            as="textarea"
            rows={4}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="A review comment is required"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={Boolean(busy)}
            onClick={() => setRejecting(null)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={Boolean(busy) || !comment.trim()}
            onClick={() => void reject()}
          >
            Reject
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
