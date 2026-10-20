import { Modal } from "react-bootstrap";

import type { SourceChangeLogEntry } from "../libraryApi";
import {
  formatSourceChangeValue,
  sourceChangeFieldLabel,
} from "../sourceChangeDisplay";

type Props = {
  entry: SourceChangeLogEntry | null;
  onHide: () => void;
};

/** Public audit-record diff. It deliberately renders only persisted changes. */
export default function SourceChangeLogDiffModal({ entry, onHide }: Props) {
  return (
    <Modal show={Boolean(entry)} onHide={onHide} centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Recorded changes</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {entry && (
          <>
            <p className="small text-muted mb-3">
              Applied {new Date(entry.createdAt).toLocaleString()}
            </p>
            {Object.keys(entry.changes).length === 0 ? (
              <p className="text-muted mb-0">
                No field-level changes recorded.
              </p>
            ) : (
              <div
                className="source-changeset-diff"
                aria-label="Source change diff"
              >
                {Object.entries(entry.changes).map(([field, change]) => (
                  <div className="source-changeset-diff-row" key={field}>
                    <div className="fw-semibold small text-uppercase text-muted">
                      {sourceChangeFieldLabel(field)}
                    </div>
                    <div className="source-changeset-diff-values">
                      <span
                        className="source-changeset-diff-before"
                        aria-label="Previous value"
                      >
                        <span aria-hidden="true">− </span>
                        {formatSourceChangeValue(change.before)}
                      </span>
                      <span
                        className="source-changeset-diff-after"
                        aria-label="New value"
                      >
                        <span aria-hidden="true">+ </span>
                        {formatSourceChangeValue(change.after)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
