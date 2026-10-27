import { useEffect, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { listMyMapSnapshots, type MapSnapshot } from "./mapApi";
import type { PublicMapReference } from "./MapReferenceAttachment";

export default function MapSnapshotPicker({ onSelect }: { onSelect: (reference: PublicMapReference) => void }) {
  const [show, setShow] = useState(false);
  const [items, setItems] = useState<MapSnapshot[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { if (!show) return; void listMyMapSnapshots().then(setItems).catch(() => setError("Unable to load saved maps.")); }, [show]);
  return <>
    <Button type="button" variant="outline-dark" size="sm" title="Attach saved map" aria-label="Attach saved map" onClick={() => { setError(""); setShow(true); }}>🌐</Button>
    <Modal show={show} onHide={() => setShow(false)} centered><Modal.Header closeButton><Modal.Title>Saved maps</Modal.Title></Modal.Header><Modal.Body>
      {error && <p className="text-danger">{error}</p>}
      {!error && !items.length && <p className="text-muted mb-0">No saved maps yet. Save a map view first.</p>}
      {items.map((item) => <button type="button" className="w-100 text-start border rounded p-2 mb-2 bg-white" key={item.id} onClick={() => { onSelect(item.reference); setShow(false); }}><strong>{item.title}</strong><span className="d-block small text-muted">{item.reference.placeName || `${item.reference.latitude.toFixed(3)}, ${item.reference.longitude.toFixed(3)}`}</span></button>)}
    </Modal.Body></Modal>
  </>;
}
