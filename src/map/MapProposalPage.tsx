import { useEffect, useState } from "react";
import { Alert } from "react-bootstrap";
import { Link } from "react-router-dom";

import PageLayout from "../component/PageLayout";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import Spinner from "../component/Spinner";
import ProposalActivityPanel from "./ProposalActivityPanel";
import { listMyMapPlaceProposals, type MapPlaceProposalRecord } from "./mapApi";

/** Private landing page for a newly proposed place before it becomes public. */
export default function MapProposalPage({ id }: { id?: string }) {
  const [proposal, setProposal] = useState<
    MapPlaceProposalRecord | null | undefined
  >(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    void listMyMapPlaceProposals()
      .then(
        (items) =>
          active && setProposal(items.find((item) => item.id === id) || null),
      )
      .catch(
        (caught: unknown) =>
          active &&
          setError(
            (caught as Error).message || "Unable to load this proposal.",
          ),
      );
    return () => {
      active = false;
    };
  }, [id]);

  if (proposal === undefined)
    return (
      <PageLayout className="map-page" header={{ title: "Place proposal" }}>
        <Spinner size="sm" />
      </PageLayout>
    );
  if (!proposal)
    return (
      <PageLayout className="map-page" header={{ title: "Place proposal" }}>
        <Alert variant="warning">
          {error || "This proposal is not available."}
        </Alert>
        <Link to="/map">Back to map</Link>
      </PageLayout>
    );
  return (
    <PageLayout
      className="map-page"
      header={{
        title: (
          <SectionBreadcrumb
            items={[{ label: "Map", to: "/map" }, { label: "Place proposal" }]}
          />
        ),
      }}
    >
      <section className="club-panel" aria-label="Place proposal">
        <h1>{proposal.canonicalName}</h1>
        <p className="text-muted">
          Pending review · {proposal.featureType.replaceAll("_", " ")}
        </p>
        <p>
          {proposal.latitude.toFixed(6)}, {proposal.longitude.toFixed(6)}
        </p>
        {proposal.description && <p>{proposal.description}</p>}
        {proposal.proposalNote && (
          <p className="small text-muted">{proposal.proposalNote}</p>
        )}
        <ProposalActivityPanel
          proposalId={proposal.id}
          proposalName={proposal.canonicalName}
        />
      </section>
    </PageLayout>
  );
}
