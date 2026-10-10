import { useEffect, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import {
  listMyMapRoleRequests,
  requestMapRole,
  withdrawMapRoleRequest,
  type MapRoleRequest,
} from "./mapApi";

const ROLE_OPTIONS: Array<{
  value: MapRoleRequest["role"];
  label: string;
  description: string;
}> = [
  {
    value: "MAP_CONTRIBUTOR",
    label: "Contributor",
    description: "Submit and amend canonical-place proposals.",
  },
  {
    value: "MAP_REVIEWER",
    label: "Reviewer",
    description: "Review proposals, comment, and request changes.",
  },
  {
    value: "MAP_EDITOR",
    label: "Editor",
    description: "Approve, reject, or merge reviewed place proposals.",
  },
];

export default function MapRoleRequestModal({
  show,
  onHide,
}: {
  show: boolean;
  onHide: () => void;
}) {
  const [requests, setRequests] = useState<MapRoleRequest[]>([]);
  const [role, setRole] = useState<MapRoleRequest["role"]>("MAP_CONTRIBUTOR");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setLoading(true);
    setError("");
    void listMyMapRoleRequests()
      .then(setRequests)
      .catch((caught: unknown) =>
        setError((caught as Error).message || "Unable to load Map roles."),
      )
      .finally(() => setLoading(false));
  }, [show]);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const request = await requestMapRole(role, note);
      setRequests((current) => [request, ...current]);
      setNote("");
    } catch (caught) {
      setError((caught as Error).message || "Unable to request this role.");
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async (request: MapRoleRequest) => {
    setWithdrawingId(request.id);
    setError("");
    try {
      const withdrawn = await withdrawMapRoleRequest(request.id);
      setRequests((current) =>
        current.map((item) => (item.id === withdrawn.id ? withdrawn : item)),
      );
    } catch (caught) {
      setError(
        (caught as Error).message ||
          "Unable to withdraw this Map role request.",
      );
    } finally {
      setWithdrawingId(null);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Map roles</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small">
          Map roles are reviewed privately. Ordinary signed-in users can still
          propose a place; these roles add review and editing responsibilities.
        </p>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form.Group className="mb-2">
          <Form.Label>Role</Form.Label>
          <Form.Select
            value={role}
            onChange={(event) =>
              setRole(event.target.value as MapRoleRequest["role"])
            }
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.description}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group>
          <Form.Label>Note (optional)</Form.Label>
          <Form.Control
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
            placeholder="Why would you like this role?"
          />
        </Form.Group>
        <h3 className="h6 mt-4">Your requests</h3>
        {loading ? (
          <Spinner animation="border" size="sm" />
        ) : requests.length === 0 ? (
          <p className="small text-muted mb-0">No Map role requests yet.</p>
        ) : (
          <ul className="list-unstyled mb-0">
            {requests.map((request) => (
              <li
                key={request.id}
                className="border-top py-2 small d-flex justify-content-between align-items-start gap-2"
              >
                <div>
                  <strong>{formatRole(request.role)}</strong>
                  <span className="text-muted ms-2">
                    {formatStatus(request.status)}
                  </span>
                  {request.decisionNote && (
                    <div className="text-muted">{request.decisionNote}</div>
                  )}
                </div>
                {request.status === "PENDING" && (
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    disabled={withdrawingId === request.id}
                    onClick={() => void withdraw(request)}
                  >
                    {withdrawingId === request.id ? "Withdrawing…" : "Withdraw"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Close
        </Button>
        <Button
          variant="dark"
          disabled={submitting}
          onClick={() => void submit()}
        >
          {submitting ? "Requesting…" : "Request role"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function formatRole(role: string): string {
  return role
    .replace(/^MAP_/, "")
    .toLocaleLowerCase()
    .replace(/^./, (value) => value.toLocaleUpperCase());
}

function formatStatus(status: string): string {
  return status
    .toLocaleLowerCase()
    .replace(/^./, (value) => value.toLocaleUpperCase());
}
