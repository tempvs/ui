import { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";

import MapCanvas from "../map/MapCanvas";
import { getMapPlace, type MapPlace } from "../map/mapApi";
import PlaceNamesList from "./PlaceNamesList";

type PlaceDetailsPanelProps = {
  placeId: string;
  /** The selected historical name, if an entity deliberately stores one. */
  displayName: string;
};

/**
 * A focused, fetch-on-mount viewer for one approved place. Both editable and
 * read-only entity pages use this so place names, historical ranges, and map
 * position stay identical regardless of who clicked the location.
 */
export default function PlaceDetailsPanel({
  placeId,
  displayName,
}: PlaceDetailsPanelProps) {
  const [place, setPlace] = useState<MapPlace | null | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    setPlace(undefined);
    void getMapPlace(placeId, controller.signal)
      .then(setPlace)
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setPlace(null);
      });
    return () => controller.abort();
  }, [placeId]);

  return (
    <section className="place-picker-selected" aria-live="polite">
      <div className="d-flex align-items-baseline justify-content-between gap-2">
        <strong>{displayName || "Selected place"}</strong>
        {place && <span className="small text-muted">{place.featureType}</span>}
      </div>
      {place === undefined ? (
        <div className="py-3 text-center">
          <Spinner animation="border" size="sm" />
        </div>
      ) : place ? (
        <>
          <div className="place-picker-map mt-2">
            <MapCanvas
              places={[{ ...place, matchedName: displayName }]}
              entities={[]}
              focus={place}
              selectedPlaceId={place.id}
              showModernBorders={false}
              onEntitySelect={() => undefined}
              onMapError={() => undefined}
            />
          </div>
          <PlaceNamesList place={place} />
          <Link
            className="small"
            to={`/map?placeId=${encodeURIComponent(placeId)}`}
          >
            Open full map
          </Link>
        </>
      ) : (
        <p className="small text-muted mb-0 mt-2">
          Place details are unavailable.
        </p>
      )}
    </section>
  );
}
