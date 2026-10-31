import { useEffect, useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import { Link } from "react-router-dom";

import PageLayout from "../component/PageLayout";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import Spinner from "../component/Spinner";
import {
  approveMapPlace,
  getMapPlace,
  listPendingMapPlaces,
  rejectMapPlace,
  type MapPlace,
  type PendingMapPlace,
} from "./mapApi";
import { getViewer, type Viewer } from "../auth/viewerApi";
import { getUserProfilesByUserIds } from "../profile/profileApi";
import { buildProfileLabel } from "../profile/currentProfile";
import type { Profile } from "../profile/profileTypes";
import ProposalActivityPanel from "./ProposalActivityPanel";

/** Focused review queue for one approved place. New-place proposals remain in
 * the global queue because they do not yet have an approved place page. */
export default function MapPlaceProposalsPage({ id }: { id?: string }) {
  const [place, setPlace] = useState<MapPlace | null | undefined>(undefined);
  const [proposals, setProposals] = useState<PendingMapPlace[]>([]);
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void Promise.all([getMapPlace(id), listPendingMapPlaces()])
      .then(([nextPlace, page]) => {
        if (!active) return;
        setPlace(nextPlace);
        setProposals(
          page.items.filter((proposal) => proposal.targetPlaceId === id),
        );
      })
      .catch((caught: unknown) => {
        if (active)
          setError(
            (caught as Error).message || "Unable to load place proposals.",
          );
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    void getViewer({ refreshRoles: true }).then(setViewer);
  }, []);

  useEffect(() => {
    const userIds = Array.from(
      new Set(proposals.flatMap((proposal) => proposal.createdByUserId ? [proposal.createdByUserId] : [])),
    );
    if (!userIds.length) return;
    void getUserProfilesByUserIds(userIds).then((items) =>
      setProfiles(Object.fromEntries(items.map((profile) => [profile.userId, profile]))),
    );
  }, [proposals]);

  const mayDecide = Boolean(
    viewer?.roles.some((role) =>
      ["TEMPVS_ADMIN", "MAP_ADMIN", "MAP_EDITOR"].includes(role),
    ),
  );
  const review = async (proposal: PendingMapPlace, decision: "approve" | "reject") => {
    setReviewingId(proposal.id);
    setError("");
    try {
      if (decision === "approve") await approveMapPlace(proposal.id, notes[proposal.id]);
      else await rejectMapPlace(proposal.id, notes[proposal.id]);
      setProposals((current) => current.filter((item) => item.id !== proposal.id));
    } catch (caught) {
      setError((caught as Error).message || "Unable to review this proposal.");
    } finally {
      setReviewingId(null);
    }
  };

  if (place === undefined)
    return (
      <PageLayout className="map-page" header={{ title: "Place proposals" }}>
        <Spinner size="sm" />
      </PageLayout>
    );
  if (!place)
    return (
      <PageLayout className="map-page" header={{ title: "Place proposals" }}>
        <Alert variant="warning">
          {error || "This place is not available."}
        </Alert>
      </PageLayout>
    );

  return (
    <PageLayout
      className="map-page"
      header={{
        title: (
          <SectionBreadcrumb
            items={[
              { label: "Map", to: "/map" },
              {
                label: place.canonicalName,
                to: `/map/place/${encodeURIComponent(place.id)}`,
              },
              { label: "Pending proposals" },
            ]}
          />
        ),
      }}
    >
      <section
        className="club-panel"
        aria-label={`Pending proposals for ${place.canonicalName}`}
      >
        <h1>Pending proposals for {place.canonicalName}</h1>
        {error && <Alert variant="warning">{error}</Alert>}
        {proposals.length === 0 ? (
          <p className="text-muted mb-0">
            No pending proposals for this place.
          </p>
        ) : (
          <ul className="list-unstyled mb-0">
            {proposals.map((proposal) => (
              <li key={proposal.id} className="border-top py-3">
                <strong>
                  {proposal.changeKind?.toLocaleLowerCase() || "update"}{" "}
                  proposal
                </strong>
                <span className="text-muted ms-2">by </span>
                {proposal.createdByUserId && profiles[proposal.createdByUserId] ? (
                  <Link to={`/profile/${profiles[proposal.createdByUserId].alias || profiles[proposal.createdByUserId].id}`}>
                    {buildProfileLabel(profiles[proposal.createdByUserId])}
                  </Link>
                ) : <span className="text-muted">Unknown profile</span>}
                {proposal.proposalNote && (
                  <p className="mb-0 mt-1">{proposal.proposalNote}</p>
                )}
                <ProposalActivityPanel proposalId={proposal.id} proposalName={proposal.canonicalName} />
                {mayDecide && (
                  <div className="d-flex gap-2 mt-2 flex-wrap">
                    <Form.Control
                      aria-label={`Review rationale for ${proposal.canonicalName}`}
                      value={notes[proposal.id] || ""}
                      placeholder="Optional for approval; required for rejection"
                      onChange={(event) => setNotes((current) => ({ ...current, [proposal.id]: event.target.value }))}
                    />
                    <Button variant="dark" disabled={reviewingId === proposal.id} onClick={() => void review(proposal, "approve")}>Approve</Button>
                    <Button variant="outline-danger" disabled={reviewingId === proposal.id || !notes[proposal.id]?.trim()} onClick={() => void review(proposal, "reject")}>Reject</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link
        className="btn btn-outline-dark mt-3"
        to={`/map/place/${encodeURIComponent(place.id)}`}
      >
        Back to place
      </Link>
    </PageLayout>
  );
}
