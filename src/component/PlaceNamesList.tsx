import type { MapPlace } from "../map/mapApi";
import { formatPlaceNameRange } from "../map/placeNames";

type PlaceNamesListProps = {
  place: Pick<MapPlace, "canonicalName" | "names">;
};

/**
 * The canonical and historical names belonging to one approved place. Keeping
 * this in one component prevents the picker, entity-page popover, and future
 * place views from disagreeing about the historical label a person chose.
 */
export default function PlaceNamesList({ place }: PlaceNamesListProps) {
  const names = place.names?.length
    ? place.names
    : [{ value: place.canonicalName, preferred: true }];
  // A spelling may be supported by different sources in different historical
  // intervals. Keep those facts separate instead of hiding all but the first
  // occurrence merely because the visible text happens to match.
  const distinctNames = names.filter((name, index) => {
    const nameKey = JSON.stringify([
      name.value,
      name.language ?? null,
      name.validFrom ?? null,
      name.validTo ?? null,
      name.preferred,
      name.confidence ?? null,
      name.provenance?.map((source) => [
        source.dataset,
        source.externalId,
        source.license,
      ]) ?? null,
    ]);
    return (
      names.findIndex(
        (candidate) =>
          JSON.stringify([
            candidate.value,
            candidate.language ?? null,
            candidate.validFrom ?? null,
            candidate.validTo ?? null,
            candidate.preferred,
            candidate.confidence ?? null,
            candidate.provenance?.map((source) => [
              source.dataset,
              source.externalId,
              source.license,
            ]) ?? null,
          ]) === nameKey,
      ) === index
    );
  });

  return (
    <ul className="map-place-name-list" aria-label="Place names">
      {distinctNames.map((name, index) => (
        <li
          key={`${name.value}:${name.language ?? ""}:${name.validFrom ?? ""}:${name.validTo ?? ""}:${index}`}
          title={
            name.provenance?.length
              ? `${name.confidence ?? "IMPORTED"}: ${name.provenance
                  .map((source) => `${source.dataset} (${source.externalId})`)
                  .join("; ")}`
              : undefined
          }
        >
          {name.value}
          {name.preferred ? " (canonical)" : ""}
          {formatPlaceNameRange(name.validFrom, name.validTo)}
        </li>
      ))}
    </ul>
  );
}
