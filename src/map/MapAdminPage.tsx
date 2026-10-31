import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import { Link } from "react-router-dom";

import { getViewer, type Viewer } from "../auth/viewerApi";
import PageLayout from "../component/PageLayout";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import AdministrationTabs from "../component/AdministrationTabs";
import RoleMemberPanel from "../component/RoleMemberPanel";
import TextFilterInput from "../component/TextFilterInput";
import Spinner from "../component/Spinner";
import { formatAppDateTime } from "../i18n/appLocale";
import {
  approveMapPlace,
  addMapMemberRole,
  approveMapRoleRequest,
  findLikelyDuplicateMapPlaces,
  getMapPlace,
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
  type MapRole,
  type MapRoleRequest,
} from "./mapApi";
import {
  getUserProfilesByUserIds,
  searchProfiles,
} from "../profile/profileApi";
import type { Profile } from "../profile/profileTypes";
import MapCanvas from "./MapCanvas";
import ProposalActivityPanel from "./ProposalActivityPanel";
import MapRoleRequestModal from "./MapRoleRequestModal";
import MapPlaceChangesetDiff from "./MapPlaceChangesetDiff";

const MAP_ROLE_OPTIONS: Array<{ value: MapRole; label: string }> = [
  { value: "MAP_ADMIN", label: "Map administrator" },
  { value: "MAP_EDITOR", label: "Editor" },
  { value: "MAP_REVIEWER", label: "Reviewer" },
];
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
  return Number.isNaN(date.getTime()) ? null : formatAppDateTime(date);
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
  const [showRoleRequestModal, setShowRoleRequestModal] = useState(false);
  const [activeTab, setActiveTab] = useState("proposals");

  useEffect(() => {
    // Map administration is frequently opened immediately after a global or
    // Map-role grant. Refresh the server-held Cognito tokens once so the
    // verified group claim (rather than a token up to 30 minutes old) drives
    // the visible controls and the subsequent API calls.
    void getViewer({ refreshRoles: true }).then(setViewer);
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
  const mayOverrideApprovals = Boolean(viewer?.roles.includes("TEMPVS_ADMIN"));
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
    <PageLayout
      className="map-page"
      header={{
        title: (
          <SectionBreadcrumb
            items={[{ label: "Map", to: "/map" }, { label: "Administration" }]}
          />
        ),
        rightContent: (
          <div className="d-flex gap-2 flex-wrap justify-content-end">
            {viewer && (
              <Button
                variant="outline-dark"
                onClick={() => setShowRoleRequestModal(true)}
              >
                Request Map role
              </Button>
            )}
            <Link className="btn btn-outline-dark" to="/map">
              View map
            </Link>
          </div>
        ),
      }}
    >
      <AdministrationTabs
        ariaLabel="Map administration"
        activeTab={activeTab}
        onSelect={setActiveTab}
        tabs={[
          {
            id: "proposals",
            label: "Pending proposals",
            disabled: !mayReview,
          },
          {
            id: "role-requests",
            label: "Role requests",
            disabled: !mayAdministerRoles,
          },
          {
            id: "members",
            label: "Map members",
            disabled: !mayAdministerRoles,
          },
        ]}
      />
      {activeTab === "proposals" && (
        <section className="club-panel" aria-label="Pending place proposals">
          <h1>Place proposals</h1>
          <p className="text-muted">
            Review every new-place proposal and approved-place changeset before
            it affects public geography.
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
          {viewer === undefined && <Spinner size="sm" />}
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
          {mayReview && loading && <Spinner size="sm" />}
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
                          {(proposal.changeKind || "CREATE").toLowerCase()}{" "}
                          changeset
                        </span>
                        {proposal.changeKind === "MERGE" &&
                          proposal.mergeTargetPlaceId && (
                            <p className="small text-muted mb-1">
                              Merge target:{" "}
                              <Link
                                to={`/map/place/${encodeURIComponent(proposal.mergeTargetPlaceId)}`}
                              >
                                {proposal.mergeTargetPlaceId}
                              </Link>
                            </p>
                          )}
                        {proposal.changeKind === "DELETE" && (
                          <p className="small text-warning mb-1">
                            This deletes the place only if it has no linked Map
                            resources.
                          </p>
                        )}
                        <span className="text-muted ms-2">
                          {proposal.featureType} ·{" "}
                          {proposal.latitude.toFixed(4)},{" "}
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
                        {proposal.proposalNote ? (
                          <p className="small mb-0 mt-1">
                            <strong>Why:</strong> {proposal.proposalNote}
                          </p>
                        ) : null}
                        {proposal.citationUrl ? (
                          <p className="small mb-0 mt-1">
                            <a
                              href={proposal.citationUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Submitted evidence
                            </a>
                          </p>
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
                          {proposal.createdByUserId === viewer?.userId &&
                          mayOverrideApprovals ? (
                            <Button
                              variant="warning"
                              disabled={reviewingId === proposal.id}
                              onClick={() => void review(proposal, "approve")}
                            >
                              {reviewingId === proposal.id
                                ? "Reviewing…"
                                : "Approve as Tempvs Admin"}
                            </Button>
                          ) : (
                            <Button
                              variant="dark"
                              disabled={reviewingId === proposal.id}
                              onClick={() => void review(proposal, "approve")}
                            >
                              {reviewingId === proposal.id
                                ? "Reviewing…"
                                : "Approve"}
                            </Button>
                          )}
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
                    {mayDecide &&
                      (!proposal.changeKind ||
                        proposal.changeKind === "CREATE") && (
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
      )}
      {mayAdministerRoles && activeTab !== "proposals" && (
        <MapRoleAdminPanel
          activeTab={activeTab as "role-requests" | "members"}
          isTempvsAdmin={Boolean(viewer?.roles.includes("TEMPVS_ADMIN"))}
          viewerUserId={viewer?.userId}
        />
      )}
      <MapRoleRequestModal
        show={showRoleRequestModal}
        onHide={() => setShowRoleRequestModal(false)}
      />
    </PageLayout>
  );
}

/** Role approvals are intentionally separate from place review. The role
 * panel only renders for Map/global admins; reviewers and editors can never
 * accidentally escalate membership through this page. */
function MapRoleAdminPanel({
  activeTab,
  isTempvsAdmin,
  viewerUserId,
}: {
  activeTab: "role-requests" | "members";
  isTempvsAdmin: boolean;
  viewerUserId?: string;
}) {
  const [requests, setRequests] = useState<MapRoleRequest[]>([]);
  const [members, setMembers] = useState<MapRoleMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextRequestCursor, setNextRequestCursor] = useState<
    string | undefined
  >();
  const [loadingMoreRequests, setLoadingMoreRequests] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [removingRole, setRemovingRole] = useState<string | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<
    Record<string, Profile>
  >({});
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([listPendingMapRoleRequests(), listMapRoleMembers()])
      .then(([requestPage, loadedMembers]) => {
        if (!active) return;
        setRequests(requestPage.items);
        setNextRequestCursor(requestPage.nextCursor);
        setMembers(loadedMembers);
        void hydrateMemberProfiles(loadedMembers);
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

  const hydrateMemberProfiles = async (
    values: readonly MapRoleMember[],
  ) => {
    try {
      const profiles = (await getUserProfilesByUserIds(
        values.map((member) => member.userId),
      )) ?? [];
      setMemberProfiles((current) => ({
        ...current,
        ...Object.fromEntries(
          profiles
            .filter((profile) => Boolean(profile.userId))
            .map((profile) => [profile.userId!, profile]),
        ),
      }));
    } catch {
      // Membership administration remains usable when profile enrichment is
      // temporarily unavailable; Cognito's display name is the fallback.
    }
  };

  const assignableRoleOptions = MAP_ROLE_OPTIONS.filter(
    (option) => isTempvsAdmin || option.value !== "MAP_ADMIN",
  );

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
        void hydrateMemberProfiles(freshMembers);
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

  const removeMember = async (member: MapRoleMember) => {
    setRemovingRole(member.userId);
    setError("");
    try {
      await Promise.all(
        member.roles.map((role) => removeMapMemberRole(member.userId, role)),
      );
      setMembers((current) => current.filter((item) => item.userId !== member.userId));
    } catch (caught) {
      setError((caught as Error).message || "Unable to remove this Map member.");
    } finally {
      setRemovingRole(null);
    }
  };

  const assignRole = async (profile: Profile, role: MapRole) => {
    if (!profile.userId) return;
    setAssigningUserId(profile.userId);
    setError("");
    try {
      await addMapMemberRole(profile.userId, role);
      const freshMembers = await listMapRoleMembers();
      setMembers(freshMembers);
      void hydrateMemberProfiles(freshMembers);
    } catch (caught) {
      setError((caught as Error).message || "Unable to assign this Map role.");
    } finally {
      setAssigningUserId(null);
    }
  };

  const updateMemberRole = async (member: MapRoleMember, role: MapRole) => {
    if (member.roles.length === 1 && member.roles[0] === role) return;
    setAssigningUserId(member.userId);
    setError("");
    try {
      await addMapMemberRole(member.userId, role);
      await Promise.all(
        member.roles
          .filter((assigned) => assigned !== role)
          .map((assigned) => removeMapMemberRole(member.userId, assigned)),
      );
      const freshMembers = await listMapRoleMembers();
      setMembers(freshMembers);
      void hydrateMemberProfiles(freshMembers);
    } catch (caught) {
      setError((caught as Error).message || "Unable to update the Map role.");
    } finally {
      setAssigningUserId(null);
    }
  };

  return (
    <section className="club-panel" aria-label="Map role management">
      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? (
        <Spinner size="sm" />
      ) : (
        <>
          {activeTab === "role-requests" && (
            <>
              <h2 className="h5">Role requests</h2>
              <p className="text-muted small">
                Review requests for Map reviewer and editor
                access. Tempvs administrators may also assign Map administrator access.
              </p>
              {requests.length === 0 ? (
                <p className="text-muted small">
                  No pending Map role requests.
                </p>
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
                            <p className="small text-muted mb-0">
                              {request.note}
                            </p>
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
            </>
          )}
          {activeTab === "members" && (
            <>
              <RoleMemberPanel
                areaLabel="Map"
                members={members.map((member) => ({
                  userId: member.userId,
                  name: member.name,
                  email: member.email,
                  role: primaryMapRole(member.roles),
                  protectedRole: member.roles.includes("MAP_ADMIN"),
                }))}
                profiles={memberProfiles}
                roleOptions={assignableRoleOptions}
                viewerUserId={viewerUserId}
                busyUserId={assigningUserId || removingRole}
                searchProfiles={(query) =>
                  searchProfiles({ query, type: "USER", size: 20 })
                }
                canChangeMember={(member) =>
                  member.userId !== viewerUserId &&
                  (!member.protectedRole || isTempvsAdmin)
                }
                onAdd={assignRole}
                onChangeRole={(member, role) => {
                  const rawMember = members.find(
                    (candidate) => candidate.userId === member.userId,
                  );
                  if (rawMember) void updateMemberRole(rawMember, role);
                }}
                onRemove={(member) => {
                  const rawMember = members.find(
                    (candidate) => candidate.userId === member.userId,
                  );
                  if (rawMember) void removeMember(rawMember);
                }}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}

function primaryMapRole(roles: readonly MapRole[]): MapRole {
  return (
    MAP_ROLE_OPTIONS.find((option) => roles.includes(option.value))?.value ??
    "MAP_REVIEWER"
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
  const [base, setBase] = useState<MapPlace | null>(null);
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
    if (proposal.targetPlaceId)
      void getMapPlace(proposal.targetPlaceId).then((place) => {
        if (!controller.signal.aborted) setBase(place);
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
            {proposal.historicalEvents?.length ? (
              <>
                <dt className="col-sm-3">Important events</dt>
                <dd className="col-sm-9 mb-0">
                  <ul className="mb-0 ps-3">
                    {proposal.historicalEvents.map((event, index) => (
                      <li
                        key={`${event.description}-${event.validFrom ?? ""}-${event.validTo ?? ""}-${index}`}
                      >
                        {formatEventYears(event.validFrom, event.validTo)} ·{" "}
                        {event.description}
                      </li>
                    ))}
                  </ul>
                </dd>
              </>
            ) : null}
            {proposal.proposalNote ? (
              <>
                <dt className="col-sm-3">Rationale</dt>
                <dd className="col-sm-9">{proposal.proposalNote}</dd>
              </>
            ) : null}
            {proposal.citationUrl ? (
              <>
                <dt className="col-sm-3">Evidence</dt>
                <dd className="col-sm-9">
                  <a
                    href={proposal.citationUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open submitted evidence
                  </a>
                </dd>
              </>
            ) : null}
          </dl>
          <MapPlaceChangesetDiff base={base} proposed={proposal} />
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

function formatEventYears(from?: number, to?: number): string {
  if (from !== undefined && to !== undefined)
    return from === to ? String(from) : `${from}–${to}`;
  if (from !== undefined) return `from ${from}`;
  return `until ${to}`;
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
  const [selectedTarget, setSelectedTarget] = useState<MapPlace | null>(null);

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
    <div className="mt-3">
      <div className="d-flex align-items-center flex-wrap gap-2">
        <small className="text-muted">Possible duplicate:</small>
        {matches.map((target) => (
          <Button
            key={target.id}
            size="sm"
            variant={
              selectedTarget?.id === target.id ? "dark" : "outline-secondary"
            }
            onClick={() => setSelectedTarget(target)}
          >
            Compare with {target.canonicalName}
          </Button>
        ))}
      </div>
      {selectedTarget && (
        <div
          className="border rounded p-3 mt-2"
          role="region"
          aria-label="Place merge comparison"
        >
          <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
            <strong className="small">
              Compare proposed place with approved place
            </strong>
            <Button
              size="sm"
              variant="link"
              className="p-0"
              onClick={() => setSelectedTarget(null)}
            >
              Close comparison
            </Button>
          </div>
          <PlaceMergeComparison proposal={proposal} target={selectedTarget} />
          <div className="d-flex align-items-center gap-2 mt-3 flex-wrap">
            <small className="text-muted">
              Merging keeps the approved place and records this proposal as a
              duplicate. A rationale is required for audit.
            </small>
            <Button
              size="sm"
              variant="outline-dark"
              disabled={disabled}
              title={
                disabled ? "Add a review rationale before merging" : undefined
              }
              onClick={() => onMerge(selectedTarget)}
            >
              Confirm merge into {selectedTarget.canonicalName}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Compare every reviewable field before an irreversible duplicate merge.
 * Green rows are identical; highlighted rows tell the editor exactly which
 * proposed values would be discarded in favour of the approved target. */
function PlaceMergeComparison({
  proposal,
  target,
}: {
  proposal: PendingMapPlace;
  target: MapPlace;
}) {
  const values = [
    ["Name", proposal.canonicalName, target.canonicalName],
    ["Type", proposal.featureType, target.featureType],
    [
      "Coordinates",
      `${proposal.latitude.toFixed(6)}, ${proposal.longitude.toFixed(6)}`,
      `${target.latitude.toFixed(6)}, ${target.longitude.toFixed(6)}`,
    ],
    [
      "Other names",
      proposal.names
        ?.filter((name) => !name.preferred)
        .map((name) => name.value)
        .join(", ") || "—",
      target.names
        ?.filter((name) => !name.preferred)
        .map((name) => name.value)
        .join(", ") || "—",
    ],
    ["Description", proposal.description || "—", target.description || "—"],
    [
      "Parent place",
      proposal.parentPlaceId || "—",
      target.parentPlaceId || "—",
    ],
    [
      "Evidence",
      proposal.citationUrl || "—",
      target.provenance?.map((item) => item.dataset).join(", ") || "—",
    ],
  ] as const;

  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Proposed</th>
            <th scope="col">Approved target</th>
          </tr>
        </thead>
        <tbody>
          {values.map(([field, proposed, approved]) => {
            const changed = proposed !== approved;
            return (
              <tr
                key={field}
                className={changed ? "table-warning" : "table-success"}
              >
                <th scope="row">{field}</th>
                <td>{proposed}</td>
                <td>{approved}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
