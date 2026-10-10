import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";

import { getViewer, type Viewer } from "../auth/viewerApi";
import PageLayout from "../component/PageLayout";
import ConfirmationModal from "../component/ConfirmationModal";
import TextFilterInput from "../component/TextFilterInput";
import {
  approveMapPlace,
  approveMapRoleRequest,
  findLikelyDuplicateMapPlaces,
  nearbyMapPlaces,
  listMapRoleMembers,
  listPendingMapRoleRequests,
  listPendingMapPlaces,
  mergeMapPlace,
  rejectMapPlace,
  rejectMapRoleRequest,
  removeMapMemberRole,
  requestMapPlaceChanges,
  type MapPlace,
  type PendingMapPlace,
  type MapRoleMember,
  type MapRoleRequest,
} from "./mapApi";
import MapCanvas from "./MapCanvas";
import ProposalActivityPanel from "./ProposalActivityPanel";

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

function canAdministerMapRoles(viewer: Viewer | null): boolean {
  return Boolean(
    viewer?.roles.some(
      (role) => role === "TEMPVS_ADMIN" || role === "MAP_ADMIN",
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
  const [filter, setFilter] = useState("");

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
  const mayAdministerRoles = useMemo(
    () => canAdministerMapRoles(viewer ?? null),
    [viewer],
  );
  const visibleProposals = useMemo(() => {
    const normalized = filter.trim().toLocaleLowerCase();
    if (!normalized) return proposals;
    return proposals.filter((proposal) =>
      [
        proposal.canonicalName,
        proposal.featureType,
        proposal.createdByUserId,
        proposal.description,
        ...(proposal.names ?? []).map((name) => name.value),
      ].some((value) => value?.toLocaleLowerCase().includes(normalized)),
    );
  }, [filter, proposals]);

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
    decision: "approve" | "reject" | "request changes",
  ) => {
    setReviewingId(proposal.id);
    setError("");
    try {
      if (decision === "approve")
        await approveMapPlace(proposal.id, notes[proposal.id]);
      else if (decision === "reject")
        await rejectMapPlace(proposal.id, notes[proposal.id]);
      else await requestMapPlaceChanges(proposal.id, notes[proposal.id]);
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
        {mayReview && proposals.length > 0 && (
          <div className="d-flex align-items-center gap-2 mb-3">
            <TextFilterInput
              value={filter}
              onChange={setFilter}
              placeholder="Filter loaded proposals"
              ariaLabel="Filter loaded place proposals"
              className="map-admin-filter"
            />
            <small className="text-muted text-nowrap">
              {visibleProposals.length} of {proposals.length} loaded
            </small>
          </div>
        )}
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
              {visibleProposals.map((proposal) => (
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
                      <ProposalDetails proposal={proposal} />
                    </div>
                    {mayDecide && (
                      <div className="d-flex gap-2 align-items-end flex-wrap">
                        <Form.Control
                          aria-label={`Review rationale for ${proposal.canonicalName}`}
                          value={notes[proposal.id] || ""}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [proposal.id]: event.target.value,
                            }))
                          }
                          placeholder="Optional for approval; required for other decisions"
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
                          disabled={
                            reviewingId === proposal.id ||
                            !notes[proposal.id]?.trim()
                          }
                          title={
                            notes[proposal.id]?.trim()
                              ? undefined
                              : "Add a review rationale before rejecting"
                          }
                          onClick={() => void review(proposal, "reject")}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="outline-secondary"
                          disabled={
                            reviewingId === proposal.id ||
                            !notes[proposal.id]?.trim()
                          }
                          title={
                            notes[proposal.id]?.trim()
                              ? undefined
                              : "Add a review rationale before requesting changes"
                          }
                          onClick={() =>
                            void review(proposal, "request changes")
                          }
                        >
                          Request changes
                        </Button>
                      </div>
                    )}
                  </div>
                  {mayDecide && (
                    <DuplicateMergeActions
                      proposal={proposal}
                      disabled={
                        reviewingId === proposal.id ||
                        !notes[proposal.id]?.trim()
                      }
                      onMerge={(target) => void merge(proposal, target)}
                    />
                  )}
                </li>
              ))}
            </ul>
            {visibleProposals.length === 0 && (
              <p className="text-muted mb-0">
                No loaded proposal matches this filter.
              </p>
            )}
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
      {mayAdministerRoles && <MapRoleAdminPanel />}
    </PageLayout>
  );
}

/** Role approvals are intentionally separate from place review. The role
 * panel only renders for Map/global admins; reviewers and editors can never
 * accidentally escalate membership through this page. */
function MapRoleAdminPanel() {
  const [requests, setRequests] = useState<MapRoleRequest[]>([]);
  const [members, setMembers] = useState<MapRoleMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextRequestCursor, setNextRequestCursor] = useState<
    string | undefined
  >();
  const [loadingMoreRequests, setLoadingMoreRequests] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [removingRole, setRemovingRole] = useState<string | null>(null);
  const [roleToRemove, setRoleToRemove] = useState<{
    member: MapRoleMember;
    role: Exclude<MapRoleMember["roles"][number], "MAP_ADMIN">;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([listPendingMapRoleRequests(), listMapRoleMembers()])
      .then(([requestPage, loadedMembers]) => {
        if (!active) return;
        setRequests(requestPage.items);
        setNextRequestCursor(requestPage.nextCursor);
        setMembers(loadedMembers);
      })
      .catch((caught: unknown) => {
        if (active)
          setError(
            (caught as Error).message || "Unable to load Map role management.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const decide = async (
    request: MapRoleRequest,
    action: "approve" | "reject",
  ) => {
    setProcessingId(request.id);
    setError("");
    try {
      if (action === "approve") await approveMapRoleRequest(request.id);
      else await rejectMapRoleRequest(request.id);
      setRequests((current) =>
        current.filter((item) => item.id !== request.id),
      );
      if (action === "approve") {
        const freshMembers = await listMapRoleMembers();
        setMembers(freshMembers);
      }
    } catch (caught) {
      setError(
        (caught as Error).message || "Unable to update this Map role request.",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const loadMoreRequests = async () => {
    if (!nextRequestCursor) return;
    setLoadingMoreRequests(true);
    setError("");
    try {
      const page = await listPendingMapRoleRequests(nextRequestCursor);
      setRequests((current) => [...current, ...page.items]);
      setNextRequestCursor(page.nextCursor);
    } catch (caught) {
      setError(
        (caught as Error).message || "Unable to load more Map role requests.",
      );
    } finally {
      setLoadingMoreRequests(false);
    }
  };

  const removeRole = async (
    member: MapRoleMember,
    role: Exclude<MapRoleMember["roles"][number], "MAP_ADMIN">,
  ) => {
    const key = `${member.userId}:${role}`;
    setRemovingRole(key);
    setError("");
    try {
      await removeMapMemberRole(member.userId, role);
      setMembers((current) =>
        current
          .map((item) =>
            item.userId === member.userId
              ? {
                  ...item,
                  roles: item.roles.filter((assigned) => assigned !== role),
                }
              : item,
          )
          .filter((item) => item.roles.length > 0),
      );
    } catch (caught) {
      setError((caught as Error).message || "Unable to remove this Map role.");
    } finally {
      setRemovingRole(null);
      setRoleToRemove(null);
    }
  };

  return (
    <section className="club-panel mt-3" aria-label="Map role management">
      <h2 className="h5">Map roles</h2>
      <p className="text-muted small">
        Map administrators review role requests and maintain Map contributor,
        reviewer, and editor access. Map admin access itself is managed outside
        this panel.
      </p>
      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? (
        <Spinner animation="border" size="sm" />
      ) : (
        <>
          <h3 className="h6">Pending requests</h3>
          {requests.length === 0 ? (
            <p className="text-muted small">No pending Map role requests.</p>
          ) : (
            <>
              <ul className="list-unstyled mb-2">
                {requests.map((request) => (
                  <li
                    key={request.id}
                    className="border-top py-2 d-flex justify-content-between gap-3 flex-wrap"
                  >
                    <div>
                      <strong>{formatMapRole(request.role)}</strong>
                      <span className="text-muted ms-2 small">
                        {request.userId}
                      </span>
                      {request.note && (
                        <p className="small text-muted mb-0">{request.note}</p>
                      )}
                    </div>
                    <div className="d-flex gap-2">
                      <Button
                        size="sm"
                        variant="dark"
                        disabled={processingId === request.id}
                        onClick={() => void decide(request, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        disabled={processingId === request.id}
                        onClick={() => void decide(request, "reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              {nextRequestCursor && (
                <Button
                  size="sm"
                  variant="outline-dark"
                  disabled={loadingMoreRequests}
                  onClick={() => void loadMoreRequests()}
                >
                  {loadingMoreRequests ? "Loading…" : "Load more requests"}
                </Button>
              )}
            </>
          )}
          <h3 className="h6">Current members</h3>
          {members.length === 0 ? (
            <p className="text-muted small mb-0">No assigned Map roles.</p>
          ) : (
            <ul className="list-unstyled mb-0">
              {members.map((member) => (
                <li
                  key={member.userId}
                  className="border-top py-2 small d-flex justify-content-between gap-3 flex-wrap"
                >
                  <div>
                    <strong>
                      {member.name || member.email || member.userId}
                    </strong>
                    <span className="text-muted ms-2">
                      {member.roles.map(formatMapRole).join(", ")}
                    </span>
                  </div>
                  <div className="d-flex gap-1 flex-wrap">
                    {member.roles
                      .filter(
                        (
                          role,
                        ): role is Exclude<
                          MapRoleMember["roles"][number],
                          "MAP_ADMIN"
                        > => role !== "MAP_ADMIN",
                      )
                      .map((role) => {
                        const key = `${member.userId}:${role}`;
                        return (
                          <Button
                            key={role}
                            size="sm"
                            variant="outline-danger"
                            disabled={removingRole === key}
                            onClick={() => setRoleToRemove({ member, role })}
                          >
                            {removingRole === key
                              ? "Removing…"
                              : `Remove ${formatMapRole(role)}`}
                          </Button>
                        );
                      })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <ConfirmationModal
        show={roleToRemove !== null}
        title="Remove Map role"
        message={
          roleToRemove ? (
            <>
              Remove <strong>{formatMapRole(roleToRemove.role)}</strong> from{" "}
              <strong>
                {roleToRemove.member.name ||
                  roleToRemove.member.email ||
                  roleToRemove.member.userId}
              </strong>
              ?
            </>
          ) : null
        }
        confirmLabel="Remove role"
        busy={roleToRemove ? removingRole !== null : false}
        onHide={() => {
          if (!removingRole) setRoleToRemove(null);
        }}
        onConfirm={() => {
          if (roleToRemove)
            void removeRole(roleToRemove.member, roleToRemove.role);
        }}
      />
    </section>
  );
}

function formatMapRole(role: string): string {
  return role
    .replace(/^MAP_/, "")
    .toLocaleLowerCase()
    .replace(/^./, (value) => value.toLocaleUpperCase());
}

/** A reviewer needs the proposed point and all submitted names before making
 * a public, irreversible decision. This stays inside the private queue: a
 * pending proposal is never linked into public map search. */
function ProposalDetails({ proposal }: { proposal: PendingMapPlace }) {
  const [open, setOpen] = useState(false);
  const [nearby, setNearby] = useState<MapPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const aliases = proposal.names?.filter((name) => !name.preferred) ?? [];

  useEffect(() => {
    if (!open) {
      setNearby([]);
      return undefined;
    }
    const controller = new AbortController();
    setNearbyLoading(true);
    void nearbyMapPlaces(
      proposal.latitude,
      proposal.longitude,
      25,
      controller.signal,
    )
      .then((items) => {
        if (!controller.signal.aborted) setNearby(items);
      })
      // The proposal remains reviewable when the optional comparison lookup
      // is unavailable; never turn this private panel into a public fallback.
      .catch(() => {
        if (!controller.signal.aborted) setNearby([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setNearbyLoading(false);
      });
    return () => controller.abort();
  }, [open, proposal.latitude, proposal.longitude]);

  return (
    <details
      className="map-admin-proposal-details mt-2"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Review submitted details and point</summary>
      {open && (
        <div className="mt-2">
          <dl className="row small mb-2">
            <dt className="col-sm-3">Coordinates</dt>
            <dd className="col-sm-9">
              {proposal.latitude.toFixed(6)}, {proposal.longitude.toFixed(6)}
            </dd>
            <dt className="col-sm-3">Type</dt>
            <dd className="col-sm-9">{proposal.featureType}</dd>
            {aliases.length > 0 && (
              <>
                <dt className="col-sm-3">Other names</dt>
                <dd className="col-sm-9 mb-0">
                  {aliases.map((name) => name.value).join(", ")}
                </dd>
              </>
            )}
          </dl>
          <div
            className="map-admin-proposal-map"
            aria-label={`Proposed point for ${proposal.canonicalName}`}
          >
            <MapCanvas
              places={[proposal, ...nearby]}
              entities={[]}
              focus={{
                latitude: proposal.latitude,
                longitude: proposal.longitude,
              }}
              showModernBorders={false}
              selectedPlaceId={proposal.id}
              onEntitySelect={() => undefined}
              onMapError={() => undefined}
            />
          </div>
          <div className="small mt-2">
            <strong>Nearby approved places</strong>
            {nearbyLoading ? (
              <span className="text-muted ms-2">Loadingâ€¦</span>
            ) : nearby.length ? (
              <ul className="mb-0 mt-1">
                {nearby.map((place) => (
                  <li key={place.id}>
                    <Link to={`/map/place/${encodeURIComponent(place.id)}`}>
                      {place.canonicalName}
                    </Link>{" "}
                    <span className="text-muted">
                      {formatDistanceKilometres(
                        proposal.latitude,
                        proposal.longitude,
                        place.latitude,
                        place.longitude,
                      )}{" "}
                      km away
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted ms-2">None within 25 km.</span>
            )}
          </div>
          <ProposalActivityPanel
            proposalId={proposal.id}
            proposalName={proposal.canonicalName}
          />
        </div>
      )}
    </details>
  );
}

function formatDistanceKilometres(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
): string {
  const radians = Math.PI / 180;
  const latitudeDelta = (secondLatitude - firstLatitude) * radians;
  const longitudeDelta = (secondLongitude - firstLongitude) * radians;
  const value =
    6371.0088 *
    2 *
    Math.atan2(
      Math.sqrt(
        Math.sin(latitudeDelta / 2) ** 2 +
          Math.cos(firstLatitude * radians) *
            Math.cos(secondLatitude * radians) *
            Math.sin(longitudeDelta / 2) ** 2,
      ),
      Math.sqrt(
        1 -
          (Math.sin(latitudeDelta / 2) ** 2 +
            Math.cos(firstLatitude * radians) *
              Math.cos(secondLatitude * radians) *
              Math.sin(longitudeDelta / 2) ** 2),
      ),
    );
  return value < 10 ? value.toFixed(1) : Math.round(value).toString();
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
          title={disabled ? "Add a review rationale before merging" : undefined}
          onClick={() => onMerge(target)}
        >
          Merge into {target.canonicalName}
        </Button>
      ))}
    </div>
  );
}
