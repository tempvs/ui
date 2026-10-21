import { Modal } from "react-bootstrap";

import StackedImageGallery from "../../component/StackedImageGallery";
import { formatAppDateTime } from "../../i18n/appLocale";
import type { LibrarySourceImage, SourceChangeLogEntry } from "../libraryApi";
import {
  formatSourceChangeValue,
  sourceChangeFieldLabel,
} from "../sourceChangeDisplay";

type Props = {
  entry: SourceChangeLogEntry | null;
  imagesById?: Record<string, LibrarySourceImage>;
  onHide: () => void;
};

/** Public audit-record diff. It deliberately renders only persisted changes. */
export default function SourceChangeLogDiffModal({
  entry,
  imagesById = {},
  onHide,
}: Props) {
  const addedImages = (entry?.addedImageIds || [])
    .map((id) => imagesById[id])
    .filter((image): image is LibrarySourceImage => Boolean(image));
  return (
    <Modal show={Boolean(entry)} onHide={onHide} centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Recorded changes</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {entry && (
          <>
            <p className="small text-muted mb-3">
              Applied {formatAppDateTime(entry.createdAt)}
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
            {addedImages.length > 0 && (
              <section
                className="mt-3"
                aria-label="Images added by this changeset"
              >
                <div className="fw-semibold small text-uppercase text-muted mb-2">
                  Added images
                </div>
                <div className="source-change-log-images">
                  {addedImages.map((image) => (
                    <StackedImageGallery
                      key={image.id}
                      images={[image]}
                      title={image.fileName || "Added source image"}
                      mode="single"
                      previewSize="compact"
                      editable={false}
                      editableDescription={false}
                      canAddImage={false}
                      wrapperClassName="source-change-log-image"
                      previewStyle={{ height: "5.5rem", objectFit: "contain" }}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
