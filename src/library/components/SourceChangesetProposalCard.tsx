import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import SourceChangesetDiff, { summarizeSourceChangeset } from "./SourceChangesetDiff";
import type {
  LibrarySource,
  LibrarySourceImage,
  SourceChangeset,
} from "../libraryApi";

type Props = {
  source: LibrarySource;
  changeset: SourceChangeset;
  expanded: boolean;
  onToggle: () => void;
  showSource?: boolean;
  context?: ReactNode;
  actions?: ReactNode;
  imagePreviews?: {
    published?: LibrarySourceImage[];
    staged?: LibrarySourceImage[];
  };
  loadingImagePreviews?: boolean;
};

/**
 * The compact proposal tile shared by source history, period queues, and the
 * library-wide review queue. Context changes between those views; the proposal
 * summary and expandable diff deliberately do not.
 */
export default function SourceChangesetProposalCard({
  source,
  changeset,
  expanded,
  onToggle,
  showSource = true,
  context,
  actions,
  imagePreviews,
  loadingImagePreviews = false,
}: Props) {
  const summary = summarizeSourceChangeset(
    changeset.base,
    changeset.proposed,
    changeset.imageOperations,
    changeset.kind,
  );
  const detailsPath = `/library/source/${source.id}/changesets/${changeset.id}`;

  return (
    <article className="stash-shell p-3 mb-3 source-changeset-card">
      <div className="d-flex justify-content-between gap-3 flex-wrap">
        <div className="min-width-0 flex-grow-1">
          {showSource && (
            <Link
              to={`/library/source/${source.id}`}
              className="source-changeset-source-link text-reset text-decoration-none text-truncate"
            >
              <strong>{source.name}</strong>
            </Link>
          )}
          {context}
          <button
            type="button"
            className="source-changeset-toggle"
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <span aria-hidden="true" className="source-changeset-toggle-glyph">
              {expanded ? "▾" : "▸"}
            </span>
            <span>
              <strong>
                {changeset.status[0]}
                {changeset.status.slice(1).toLowerCase()} changeset
              </strong>
              <span className="source-changeset-summary">
                {summary.length ? summary.join(" · ") : "No content changes"}
              </span>
              <span className="small text-muted d-block mt-1">
                Submitted {new Date(changeset.createdAt).toLocaleString()}
              </span>
            </span>
          </button>
        </div>
        <div className="d-flex gap-2 align-items-start">
          {actions}
          <Link className="btn btn-outline-dark btn-sm" to={detailsPath}>
            Open
          </Link>
        </div>
      </div>
      {expanded && (
        <div className="source-changeset-expanded">
          {loadingImagePreviews ? (
            <div className="small text-muted">Loading image previews…</div>
          ) : (
            <SourceChangesetDiff
              compact
              base={changeset.base}
              proposed={changeset.proposed}
              kind={changeset.kind}
              imageOperations={changeset.imageOperations}
              imagePreviews={
                changeset.imageOperations.length > 0 ? imagePreviews : undefined
              }
            />
          )}
        </div>
      )}
    </article>
  );
}
