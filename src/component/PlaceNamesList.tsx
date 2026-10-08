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
  const distinctNames = names.filter(
    (name, index) =>
      names.findIndex((candidate) => candidate.value === name.value) === index,
  );

  return (
    <ul className="map-place-name-list" aria-label="Place names">
      {distinctNames.map((name, index) => (
        <li key={`${name.value}:${index}`}>
          {name.value}
          {name.preferred ? " (canonical)" : ""}
          {formatPlaceNameRange(name.validFrom, name.validTo)}
        </li>
      ))}
    </ul>
  );
}
