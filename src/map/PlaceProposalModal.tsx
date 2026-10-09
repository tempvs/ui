import { useEffect, useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";

import {
  amendMapPlaceProposal,
  findLikelyDuplicateMapPlaces,
  proposeMapPlace,
  type MapPlace,
  type MapPlaceProposalRecord,
} from "./mapApi";

type PlaceProposalModalProps = {
  show: boolean;
  initialLatitude?: string;
  initialLongitude?: string;
  proposal?: MapPlaceProposalRecord | null;
  onSubmitted?: (proposal: MapPlaceProposalRecord) => void;
  onHide: () => void;
};

/** A small, deliberate point-only proposal form. Place geometry is not yet
 * user-editable; every proposal is reviewed before becoming searchable. */
export default function PlaceProposalModal({
  show,
  initialLatitude = "",
  initialLongitude = "",
  proposal = null,
  onSubmitted,
  onHide,
}: PlaceProposalModalProps) {
  const [name, setName] = useState(proposal?.canonicalName ?? "");
  const [featureType, setFeatureType] = useState(
    proposal?.featureType ?? "SETTLEMENT",
  );
  const [latitude, setLatitude] = useState(
    proposal ? String(proposal.latitude) : initialLatitude,
  );
  const [longitude, setLongitude] = useState(
    proposal ? String(proposal.longitude) : initialLongitude,
  );
  const [description, setDescription] = useState(proposal?.description ?? "");
  const [aliases, setAliases] = useState(placeAliases(proposal));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [duplicates, setDuplicates] = useState<MapPlace[]>([]);

  useEffect(() => {
    if (!show) return;
    setName(proposal?.canonicalName ?? "");
    setFeatureType(proposal?.featureType ?? "SETTLEMENT");
    setLatitude(proposal ? String(proposal.latitude) : initialLatitude);
    setLongitude(proposal ? String(proposal.longitude) : initialLongitude);
    setDescription(proposal?.description ?? "");
    setAliases(placeAliases(proposal));
    setError("");
    setSubmitted(false);
    setDuplicates([]);
  }, [initialLatitude, initialLongitude, proposal, show]);

  useEffect(() => {
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    const normalizedName = name.trim();
    if (
      !show ||
      normalizedName.length < 2 ||
      !latitude.trim() ||
      !longitude.trim() ||
      !Number.isFinite(parsedLatitude) ||
      parsedLatitude < -90 ||
      parsedLatitude > 90 ||
      !Number.isFinite(parsedLongitude) ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      setDuplicates([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void findLikelyDuplicateMapPlaces(
        normalizedName,
        parsedLatitude,
        parsedLongitude,
        controller.signal,
      )
        .then(setDuplicates)
        .catch(() => {
          if (!controller.signal.aborted) setDuplicates([]);
        });
    }, 350);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [latitude, longitude, name, show]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    if (!name.trim() || !featureType.trim()) {
      setError("Name and type are required.");
      return;
    }
    if (
      !latitude.trim() ||
      !longitude.trim() ||
      !Number.isFinite(parsedLatitude) ||
      parsedLatitude < -90 ||
      parsedLatitude > 90 ||
      !Number.isFinite(parsedLongitude) ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      setError("Enter a valid latitude and longitude.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const values = {
        canonicalName: name.trim(),
        featureType: featureType.trim(),
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(aliases.trim()
          ? {
              aliases: aliases
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
            }
          : {}),
      };
      const saved = proposal
        ? await amendMapPlaceProposal(proposal.id, values)
        : await proposeMapPlace(values);
      onSubmitted?.(saved);
      setSubmitted(true);
    } catch (caught) {
      setError((caught as Error).message || "Unable to submit the proposal.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {proposal ? "Amend place proposal" : "Propose a place"}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={submit}>
        <Modal.Body>
          {submitted ? (
            <Alert variant="success" className="mb-0">
              {proposal ? "Resubmitted for review." : "Submitted for review."}{" "}
              It will appear in public place search once approved.
            </Alert>
          ) : (
            <>
              <p className="small text-muted">
                Proposals are points. Use the coordinates for the town, site,
                museum, or other shared place—not a private address.
              </p>
              <Form.Group className="mb-2">
                <Form.Label>Name</Form.Label>
                <Form.Control
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={200}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label>Type</Form.Label>
                <Form.Control
                  value={featureType}
                  onChange={(event) => setFeatureType(event.target.value)}
                  placeholder="Settlement, museum, historic site…"
                  maxLength={80}
                  required
                />
              </Form.Group>
              <div className="d-flex gap-2">
                <Form.Group className="mb-2 flex-fill">
                  <Form.Label>Latitude</Form.Label>
                  <Form.Control
                    value={latitude}
                    onChange={(event) => setLatitude(event.target.value)}
                    inputMode="decimal"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-2 flex-fill">
                  <Form.Label>Longitude</Form.Label>
                  <Form.Control
                    value={longitude}
                    onChange={(event) => setLongitude(event.target.value)}
                    inputMode="decimal"
                    required
                  />
                </Form.Group>
              </div>
              <Form.Group className="mb-2">
                <Form.Label>Other names</Form.Label>
                <Form.Control
                  value={aliases}
                  onChange={(event) => setAliases(event.target.value)}
                  placeholder="Comma-separated aliases"
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Description</Form.Label>
                <Form.Control
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={1000}
                />
              </Form.Group>
              {duplicates.length > 0 && (
                <Alert className="mt-3 mb-0" variant="warning">
                  <strong>Possible existing place{duplicates.length > 1 ? "s" : ""}:</strong>{" "}
                  {duplicates.map((place) => place.canonicalName).join(", ")}.{" "}
                  Search the map before submitting a duplicate.
                </Alert>
              )}
              {error && (
                <Alert className="mt-3 mb-0" variant="danger">
                  {error}
                </Alert>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            {submitted ? "Done" : "Cancel"}
          </Button>
          {!submitted && (
            <Button type="submit" variant="dark" disabled={saving}>
              {saving
                ? proposal
                  ? "Saving…"
                  : "Submitting…"
                : proposal
                  ? "Resubmit for review"
                  : "Submit for review"}
            </Button>
          )}
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function placeAliases(proposal: MapPlaceProposalRecord | null): string {
  return (
    proposal?.names
      ?.filter((entry) => !entry.preferred)
      .map((entry) => entry.value)
      .join(", ") ?? ""
  );
}
