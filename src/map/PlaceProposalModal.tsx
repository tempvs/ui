import { useEffect, useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";

import { proposeMapPlace } from "./mapApi";

type PlaceProposalModalProps = {
  show: boolean;
  initialLatitude?: string;
  initialLongitude?: string;
  onHide: () => void;
};

/** A small, deliberate point-only proposal form. Place geometry is not yet
 * user-editable; every proposal is reviewed before becoming searchable. */
export default function PlaceProposalModal({
  show,
  initialLatitude = "",
  initialLongitude = "",
  onHide,
}: PlaceProposalModalProps) {
  const [name, setName] = useState("");
  const [featureType, setFeatureType] = useState("SETTLEMENT");
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);
  const [description, setDescription] = useState("");
  const [aliases, setAliases] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!show) return;
    setLatitude(initialLatitude);
    setLongitude(initialLongitude);
    setError("");
    setSubmitted(false);
  }, [initialLatitude, initialLongitude, show]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    if (!name.trim() || !featureType.trim()) {
      setError("Name and type are required.");
      return;
    }
    if (
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
      await proposeMapPlace({
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
      });
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
        <Modal.Title>Propose a place</Modal.Title>
      </Modal.Header>
      <Form onSubmit={submit}>
        <Modal.Body>
          {submitted ? (
            <Alert variant="success" className="mb-0">
              Submitted for review. It will appear in public place search once
              approved.
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
              {saving ? "Submitting…" : "Submit for review"}
            </Button>
          )}
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
