import { useState } from "react";
import { Button, Modal } from "react-bootstrap";

import PlaceDetailsPanel from "./PlaceDetailsPanel";

type PlaceNamePopoverProps = {
  placeId: string;
  displayName: string;
  className?: string;
};

/** Read-only entity-page reference with the same map-backed context as the
 * editable location picker. */
export default function PlaceNamePopover({
  placeId,
  displayName,
  className = "small text-start px-1 py-1 d-inline-block",
}: PlaceNamePopoverProps) {
  const [show, setShow] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`place-name-popover-trigger ${className}`}
        onClick={() => setShow(true)}
      >
        {displayName}
      </button>
      <Modal show={show} onHide={() => setShow(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Place details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {show && (
            <PlaceDetailsPanel placeId={placeId} displayName={displayName} />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShow(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
