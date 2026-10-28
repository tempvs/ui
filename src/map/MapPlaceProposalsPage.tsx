import { useEffect, useState } from "react";
import { Alert } from "react-bootstrap";
import { Link } from "react-router-dom";

import PageLayout from "../component/PageLayout";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import Spinner from "../component/Spinner";
import {
  getMapPlace,
  listPendingMapPlaces,
  type MapPlace,
  type PendingMapPlace,
} from "./mapApi";

/** Focused review queue for one approved place. New-place proposals remain in
 * the global queue because they do not yet have an approved place page. */
export default function MapPlaceProposalsPage({ id }: { id?: string }) {
  const [place, setPlace] = useState<MapPlace | null | undefined>(undefined);
  const [proposals, setProposals] = useState<PendingMapPlace[]>([]);
  const [error, setError] = useState("");

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
                <span className="text-muted ms-2">
                  by {proposal.createdByUserId || "Unknown"}
                </span>
                {proposal.proposalNote && (
                  <p className="mb-0 mt-1">{proposal.proposalNote}</p>
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
