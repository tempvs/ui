import { useEffect, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { FaGlobeAmericas } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { getImageThumbnails } from "../image/imageApi";
import MapCanvas, { type MapThumbnailMarker } from "../map/MapCanvas";
import {
  getMapPlace,
  nearbyMapEntities,
  type MapEntityLocation,
  type MapPlace,
} from "../map/mapApi";

type RelatedMapModalProps = {
  placeId: string;
  displayName: string;
  /** A compact default comparison area. The full map can widen it later. */
  radiusKm?: number;
};

const GlobeIcon = FaGlobeAmericas as React.ComponentType<{
  className?: string;
}>;
const entityTypes: MapEntityLocation["entityType"][] = [
  "PROFILE",
  "CLUB",
  "EVENT",
  "SOURCE",
];
const radiusOptions = [5, 25, 50, 100, 200];

/**
 * Shared entry point from location fields. A place remains the focus, while
 * the compact public Map projection supplies nearby profiles, clubs, events,
 * and sources without each entity page inventing a different map widget.
 */
export default function RelatedMapModal({
  placeId,
  displayName,
  radiusKm = 25,
}: RelatedMapModalProps) {
  const [show, setShow] = useState(false);
  const [place, setPlace] = useState<MapPlace | null | undefined>(undefined);
  const [entities, setEntities] = useState<MapEntityLocation[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [radius, setRadius] = useState(radiusKm);
  const [types, setTypes] =
    useState<MapEntityLocation["entityType"][]>(entityTypes);
  const navigate = useNavigate();

  useEffect(() => {
    if (!show) return undefined;
    const controller = new AbortController();
    setPlace(undefined);
    setEntities([]);
    setThumbnails({});
    setError("");
    void getMapPlace(placeId, controller.signal)
      .then((nextPlace) => {
        if (!nextPlace) {
          setPlace(null);
          return;
        }
        setPlace(nextPlace);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError((caught as Error).message || "Unable to load related map.");
      });
    return () => controller.abort();
  }, [placeId, show]);

  useEffect(() => {
    if (!show || !place) return undefined;
    if (!types.length) {
      setEntities([]);
      return undefined;
    }
    const controller = new AbortController();
    void nearbyMapEntities(
      place.latitude,
      place.longitude,
      radius,
      types,
      undefined,
      controller.signal,
    )
      .then((nearby) => {
        if (!controller.signal.aborted) setEntities(nearby);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError((caught as Error).message || "Unable to load related map.");
      });
    return () => controller.abort();
  }, [place, radius, show, types]);

  useEffect(() => {
    if (!show || !entities.length) {
      setThumbnails({});
      return undefined;
    }
    let active = true;
    void getImageThumbnails(
      entities.map((entity) => ({
        resourceType: entity.entityType.toLowerCase(),
        resourceId: entity.entityId,
      })),
    )
      .then((items) => {
        if (!active) return;
        setThumbnails(
          Object.fromEntries(
            items.flatMap((item) => {
              const url = item.image?.thumbnailUrl || item.image?.url;
              return url
                ? [
                    [
                      `${item.resourceType.toUpperCase()}:${item.resourceId}`,
                      url,
                    ],
                  ]
                : [];
            }),
          ),
        );
      })
      // Markers deliberately retain the shared hourglass fallback if the
      // image service is briefly unavailable; geography itself remains usable.
      .catch(() => active && setThumbnails({}));
    return () => {
      active = false;
    };
  }, [entities, show]);

  const toggleType = (type: MapEntityLocation["entityType"]) => {
    setTypes((current) =>
      current.includes(type)
        ? current.filter((entry) => entry !== type)
        : [...current, type],
    );
  };

  const thumbnailMarkers: MapThumbnailMarker[] = entities.map((entity) => ({
    key: `${entity.entityType}:${entity.entityId}:${entity.locationRole}`,
    entityType: entity.entityType,
    entityId: entity.entityId,
    label: entity.label,
    placeId: entity.placeId,
    placeName: entity.placeName,
    latitude: entity.latitude,
    longitude: entity.longitude,
    thumbnailUrl: thumbnails[`${entity.entityType}:${entity.entityId}`],
  }));

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="related-map-trigger p-0 ms-1 align-baseline"
        aria-label={`Open related map for ${displayName}`}
        title="Open related map"
        onClick={() => setShow(true)}
      >
        <GlobeIcon />
      </Button>
      <Modal show={show} onHide={() => setShow(false)} centered size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Related map: {displayName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {place === undefined && !error && (
            <div className="py-4 text-center">
              <Spinner animation="border" size="sm" />
            </div>
          )}
          {error && <Alert variant="warning">{error}</Alert>}
          {place === null && !error && (
            <Alert variant="warning">This place is no longer available.</Alert>
          )}
          {place && (
            <>
              <div className="d-flex align-items-end gap-3 flex-wrap mb-2">
                <Form.Group>
                  <Form.Label className="small mb-1">Radius</Form.Label>
                  <Form.Select
                    size="sm"
                    aria-label="Related-map radius"
                    value={radius}
                    onChange={(event) => setRadius(Number(event.target.value))}
                  >
                    {radiusOptions.map((value) => (
                      <option key={value} value={value}>
                        {value} km
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <div>
                  <span className="small d-block mb-1">Show</span>
                  {entityTypes.map((type) => (
                    <Form.Check
                      inline
                      key={type}
                      id={`related-map-${place.id}-${type}`}
                      type="checkbox"
                      label={type[0] + type.slice(1).toLowerCase()}
                      checked={types.includes(type)}
                      onChange={() => toggleType(type)}
                    />
                  ))}
                </div>
              </div>
              <p className="small text-muted">
                Public content within {radius} km of this location.
              </p>
              <div className="related-map-canvas">
                <MapCanvas
                  places={[{ ...place, matchedName: displayName }]}
                  entities={entities}
                  thumbnailMarkers={thumbnailMarkers}
                  focus={place}
                  selectedPlaceId={place.id}
                  showModernBorders={false}
                  onEntitySelect={() => undefined}
                  onThumbnailMarkerSelect={(marker) =>
                    navigate(entityPath(marker.entityType, marker.entityId))
                  }
                  onMapError={setError}
                />
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

function entityPath(
  entityType: MapEntityLocation["entityType"],
  entityId: string,
): string {
  switch (entityType) {
    case "PROFILE":
      return `/profile/${entityId}`;
    case "CLUB":
      return `/clubs/${entityId}`;
    case "EVENT":
      return `/events/${entityId}`;
    case "SOURCE":
      return `/library/source/${entityId}`;
  }
}
