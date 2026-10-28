import ChangeLogDiffModal from "../component/ChangeLogDiffModal";
import type { MapPlaceProposalActivity } from "./mapApi";

export default function MapPlaceChangeLogDiffModal({
  entry,
  previous,
  onHide,
}: {
  entry: MapPlaceProposalActivity | null;
  previous?: MapPlaceProposalActivity["revision"];
  onHide: () => void;
}) {
  const revision = entry?.revision;
  const rows = revision
    ? [
        ["Name", previous?.canonicalName, revision.canonicalName],
        ["Type", previous?.featureType, revision.featureType],
        [
          "Coordinates",
          previous
            ? `${previous.latitude.toFixed(6)}, ${previous.longitude.toFixed(6)}`
            : undefined,
          `${revision.latitude.toFixed(6)}, ${revision.longitude.toFixed(6)}`,
        ],
        ["Description", previous?.description, revision.description],
        ["Evidence URL", previous?.citationUrl, revision.citationUrl],
      ].filter(([, before, after]) => before !== after)
    : [];
  return (
    <ChangeLogDiffModal
      show={Boolean(entry)}
      title="Place changes"
      occurredAt={entry?.occurredAt}
      onHide={onHide}
    >
      {rows.length ? (
        <div className="source-changeset-diff">
          {rows.map(([field, before, after]) => (
            <div className="source-changeset-diff-row" key={field}>
              <div className="fw-semibold small text-uppercase text-muted">
                {field}
              </div>
              <div className="source-changeset-diff-values">
                <span className="source-changeset-diff-before">
                  − {before || "—"}
                </span>
                <span className="source-changeset-diff-after">
                  + {after || "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted mb-0">No field-level changes recorded.</p>
      )}
    </ChangeLogDiffModal>
  );
}
