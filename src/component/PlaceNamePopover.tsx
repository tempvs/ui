import { useState } from "react";
import { OverlayTrigger, Popover, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";

import { getMapPlace, type MapPlace } from "../map/mapApi";
import { formatPlaceNameRange } from "../map/placeNames";

type PlaceNamePopoverProps = {
  placeId: string;
  displayName: string;
  className?: string;
};

/** Compact entity-page reference with on-demand historical-name context. */
export default function PlaceNamePopover({
  placeId,
  displayName,
  className = "small text-start px-1 py-1 d-inline-block",
}: PlaceNamePopoverProps) {
  const [place, setPlace] = useState<MapPlace | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (loading || place !== undefined) return;
    setLoading(true);
    void getMapPlace(placeId)
      .then(setPlace)
      .catch(() => setPlace(null))
      .finally(() => setLoading(false));
  };

  return (
    <OverlayTrigger
      trigger="click"
      rootClose
      placement="auto"
      overlay={
        <Popover className="map-place-popover">
          <Popover.Body>
            {loading || place === undefined ? (
              <Spinner animation="border" size="sm" />
            ) : place ? (
              <>
                <strong>{displayName}</strong>
                <ul className="map-place-name-list">
                  {(place.names?.length
                    ? place.names
                    : [{ value: place.canonicalName, preferred: true }]
                  ).map((name, index) => (
                    <li key={`${name.value}:${index}`}>
                      {name.value}
                      {name.preferred ? " (canonical)" : ""}
                      {formatPlaceNameRange(name.validFrom, name.validTo)}
                    </li>
                  ))}
                </ul>
                <Link to={`/map?placeId=${encodeURIComponent(placeId)}`}>
                  Open on map
                </Link>
              </>
            ) : (
              <span>Place details are unavailable.</span>
            )}
          </Popover.Body>
        </Popover>
      }
    >
      <button
        type="button"
        className={`place-name-popover-trigger ${className}`}
        onClick={load}
      >
        {displayName}
      </button>
    </OverlayTrigger>
  );
}
