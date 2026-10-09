import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";

import { getViewer, type Viewer } from "../auth/viewerApi";
import PageLayout from "../component/PageLayout";
import {
  approveMapPlace,
  findLikelyDuplicateMapPlaces,
  listPendingMapPlaces,
  mergeMapPlace,
  rejectMapPlace,
  type MapPlace,
  type PendingMapPlace,
} from "./mapApi";

function canViewPlaceReviews(viewer: Viewer | null): boolean {
  return Boolean(
    viewer?.roles.some(
      (role) =>
        role === "TEMPVS_ADMIN" ||
        role === "MAP_ADMIN" ||
        role === "MAP_EDITOR" ||
        role === "MAP_REVIEWER",
    ),
  );
}

function canDecidePlaceReviews(viewer: Viewer | null): boolean {
  return Boolean(
    viewer?.roles.some(
      (role) =>
        role === "TEMPVS_ADMIN" ||
        role === "MAP_ADMIN" ||
        role === "MAP_EDITOR",
    ),
  );
}

function submittedLabel(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}
/** Private review queue. Pending places are deliberately not visible in the
 * public map/search endpoint until this approval has happened. */
export default function MapAdminPage() {
  const [viewer, setViewer] = useState<Viewer | null | undefined>(undefined);
  const [proposals, setProposals] = useState<PendingMapPlace[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    void getViewer().then(setViewer);
  }, []);

  const mayReview = useMemo(
    () => canViewPlaceReviews(viewer ?? null),
    [viewer],
  );
  const mayDecide = useMemo(
    () => canDecidePlaceReviews(viewer ?? null),
    [viewer],
  );

  useEffect(() => {
    if (!mayReview) return;
    setLoading(true);
    setError("");
    void listPendingMapPlaces()
      .then((page) => {
        setProposals(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((caught: unknown) =>
        setError((caught as Error).message || "Unable to load proposals."),
      )
      .finally(() => setLoading(false));
  }, [mayReview]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoading(true);
    setError("");
    try {
      const page = await listPendingMapPlaces(nextCursor);
      setProposals((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (caught) {
      setError((caught as Error).message || "Unable to load more proposals.");
    } finally {
      setLoading(false);
    }
  };

  const review = async (
    proposal: PendingMapPlace,
    decision: "approve" | "reject",
  ) => {
    setReviewingId(proposal.id);
    setError("");
    try {
      if (decision === "approve")
        await approveMapPlace(proposal.id, notes[proposal.id]);
      else await rejectMapPlace(proposal.id, notes[proposal.id]);
      setProposals((current) =>
        current.filter((item) => item.id !== proposal.id),
      );
    } catch (caught) {
      setError(
        (caught as Error).message || `Unable to ${decision} this place.`,
      );
    } finally {
      setReviewingId(null);
    }
  };

  const merge = async (proposal: PendingMapPlace, target: MapPlace) => {
    setReviewingId(proposal.id);
    setError("");
    try {
      await mergeMapPlace(proposal.id, target.id, notes[proposal.id]);
      setProposals((current) =>
        current.filter((item) => item.id !== proposal.id),
      );
    } catch (caught) {
      setError((caught as Error).message || "Unable to merge this place.");
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <PageLayout className="map-page" header={{ title: "Map administration" }}>
      <section className="club-panel" aria-label="Pending place proposals">
        <h1>Place proposals</h1>
        <p className="text-muted">
          Approve a proposed point only after checking that it is useful,
          accurately located, and not a duplicate of an approved place.
        </p>
        {viewer === undefined && <Spinner animation="border" size="sm" />}
        {viewer !== undefined && !mayReview && (
          <Alert className="mb-0" variant="warning">
            Map reviewer access is required to view place proposals.
          </Alert>
        )}
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}
        {mayReview && loading && <Spinner animation="border" size="sm" />}
        {mayReview && !loading && proposals.length === 0 && !error && (
          <p className="text-muted mb-0">There are no pending proposals.</p>
        )}
        {mayReview && proposals.length > 0 && (
          <>
            <ul className="list-unstyled mb-0">
              {proposals.map((proposal) => (
                <li key={proposal.id} className="border-top py-3">
                  <div className="d-flex justify-content-between gap-3 flex-wrap">
                    <div>
                      <strong>{proposal.canonicalName}</strong>
                      <span className="text-muted ms-2">
                        {proposal.featureType} · {proposal.latitude.toFixed(4)},{" "}
                        {proposal.longitude.toFixed(4)}
                      </span>
                      {(proposal.createdByUserId ||
                        submittedLabel(proposal.createdAt)) && (
                        <p className="small text-muted mb-1">
                          {proposal.createdByUserId
                            ? `Submitted by ${proposal.createdByUserId}`
                            : "Submitted"}
                          {submittedLabel(proposal.createdAt)
                            ? ` on ${submittedLabel(proposal.createdAt)}`
                            : ""}
                        </p>
                      )}
                      {proposal.names?.filter((name) => !name.preferred)
                        .length ? (
                        <p className="small text-muted mb-1">
                          Also known as:{" "}
                          {proposal.names
                            .filter((name) => !name.preferred)
                            .map((name) => name.value)
                            .join(", ")}
                        </p>
                      ) : null}
                      {proposal.description ? (
                        <p className="mb-0">{proposal.description}</p>
                      ) : null}
                    </div>
                    {mayDecide && (
                      <div className="d-flex gap-2 align-items-end flex-wrap">
                        <Form.Control
                          aria-label={`Approval note for ${proposal.canonicalName}`}
                          value={notes[proposal.id] || ""}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [proposal.id]: event.target.value,
                            }))
                          }
                          placeholder="Optional review note"
                          maxLength={2000}
                        />
                        <Button
                          variant="dark"
                          disabled={reviewingId === proposal.id}
                          onClick={() => void review(proposal, "approve")}
                        >
                          {reviewingId === proposal.id
                            ? "Reviewing…"
                            : "Approve"}
                        </Button>
                        <Button
                          variant="outline-danger"
                          disabled={reviewingId === proposal.id}
                          onClick={() => void review(proposal, "reject")}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                  {mayDecide && (
                    <DuplicateMergeActions
                      proposal={proposal}
                      disabled={reviewingId === proposal.id}
                      onMerge={(target) => void merge(proposal, target)}
                    />
                  )}
                </li>
              ))}
            </ul>
            {nextCursor && (
              <Button
                className="mt-3"
                variant="outline-dark"
                disabled={loading}
                onClick={() => void loadMore()}
              >
                {loading ? "Loading…" : "Load more"}
              </Button>
            )}
          </>
        )}
      </section>
    </PageLayout>
  );
}

function DuplicateMergeActions({
  proposal,
  disabled,
  onMerge,
}: {
  proposal: PendingMapPlace;
  disabled: boolean;
  onMerge: (target: MapPlace) => void;
}) {
  const [matches, setMatches] = useState<MapPlace[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    void findLikelyDuplicateMapPlaces(
      proposal.canonicalName,
      proposal.latitude,
      proposal.longitude,
      controller.signal,
    )
      .then(setMatches)
      .catch(() => {
        if (!controller.signal.aborted) setMatches([]);
      });
    return () => controller.abort();
  }, [proposal.canonicalName, proposal.latitude, proposal.longitude]);

  if (matches.length === 0) return null;
  return (
    <div className="mt-2 d-flex align-items-center flex-wrap gap-2">
      <small className="text-muted">Possible duplicate:</small>
      {matches.map((target) => (
        <Button
          key={target.id}
          size="sm"
          variant="outline-secondary"
          disabled={disabled}
          onClick={() => onMerge(target)}
        >
          Merge into {target.canonicalName}
        </Button>
      ))}
    </div>
  );
}
