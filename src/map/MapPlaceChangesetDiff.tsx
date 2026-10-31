import type { MapPlace, PendingMapPlace } from "./mapApi";

/** Uses the same review-diff visual language as source changesets. */
export default function MapPlaceChangesetDiff({
  base,
  proposed,
}: {
  base: MapPlace | null;
  proposed: PendingMapPlace;
}) {
  const fields: Array<[string, unknown, unknown]> = base
    ? [
        ["Name", base.canonicalName, proposed.canonicalName],
        ["Description", base.description, proposed.description],
        ["Type", base.featureType, proposed.featureType],
        ["Coordinates", coordinates(base), coordinates(proposed)],
        ["Names", names(base), names(proposed)],
        ["Important events", events(base), events(proposed)],
        ["Periods", (base.periods || []).join(", "), (proposed.periods || []).join(", ")],
        ["Evidence URL", base.citationUrl, proposed.citationUrl],
      ]
    : [
        ["Name", null, proposed.canonicalName],
        ["Description", null, proposed.description],
        ["Type", null, proposed.featureType],
        ["Coordinates", null, coordinates(proposed)],
        ["Names", null, names(proposed)],
        ["Important events", null, events(proposed)],
        ["Periods", null, (proposed.periods || []).join(", ")],
        ["Evidence URL", null, proposed.citationUrl],
      ];
  const changed = fields.filter(([, before, after]) => !base || JSON.stringify(before) !== JSON.stringify(after));
  return (
    <div className="mt-2" aria-label="Proposed changes">
      <strong className="small">Changes</strong>
      {changed.length ? changed.map(([label, before, after]) => (
        <div className="source-changeset-diff-row" key={label}>
          <div className="fw-semibold small text-uppercase text-muted">{label}</div>
          <div className="source-changeset-diff-values">
            {base && <span className="source-changeset-diff-before">− {value(before)}</span>}
            <span className="source-changeset-diff-after">+ {value(after)}</span>
          </div>
        </div>
      )) : <p className="text-muted mb-0">No field changes.</p>}
    </div>
  );
}

function value(input: unknown): string { return input == null || input === "" ? "—" : String(input); }
function coordinates(place: Pick<MapPlace, "latitude" | "longitude">): string { return `${place.latitude.toFixed(6)}, ${place.longitude.toFixed(6)}`; }
function names(place: Pick<MapPlace, "names">): string { return (place.names || []).map((name) => name.value).join(", "); }
function events(place: Pick<MapPlace, "historicalEvents">): string {
  return (place.historicalEvents || []).map((event) => `${event.validFrom ?? "?"}–${event.validTo ?? "?"}: ${event.description}`).join("; ");
}
