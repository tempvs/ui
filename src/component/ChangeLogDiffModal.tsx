import type { ReactNode } from "react";
import { Modal } from "react-bootstrap";

import { formatAppDateTime } from "../i18n/appLocale";

export default function ChangeLogDiffModal({
  show,
  title = "Recorded changes",
  occurredAt,
  onHide,
  children,
}: {
  show: boolean;
  title?: string;
  occurredAt?: string;
  onHide: () => void;
  children: ReactNode;
}) {
  return (
    <Modal show={show} onHide={onHide} centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {occurredAt && (
          <p className="small text-muted mb-3">
            Recorded {formatAppDateTime(occurredAt)}
          </p>
        )}
        {children}
      </Modal.Body>
    </Modal>
  );
}
