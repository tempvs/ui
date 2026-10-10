import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { FaGlobeAmericas } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { getImageThumbnails } from "../image/imageApi";
import type { HistoricalYearInput } from "../component/HistoricalRangeFilter";
import MapCanvas, { type MapThumbnailMarker } from "../map/MapCanvas";
import MapEntityFilterControls from "../map/MapEntityFilterControls";
import type { OwnedMapContent } from "../map/ownedMapContent";
import {
  getMapPlace,
  nearbyMapEntities,
  type MapEntityLocation,
  type MapEventFilters,
  type MapPlace,
  type MapSourceFilters,
  type SourceLocationRole,
} from "../map/mapApi";

type RelatedMapModalProps = {
  placeId: string;
  displayName: string;
  /** A compact default comparison area. The full map can widen it later. */
  radiusKm?: number;
  /** Page-scoped relation data (for example a profile's public clubs/sources).
   * This intentionally never becomes part of the public nearby-map endpoint. */
  loadRelatedMapContent?: () => Promise<OwnedMapContent>;
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
  loadRelatedMapContent,
}: RelatedMapModalProps) {
  const [show, setShow] = useState(false);
  const [place, setPlace] = useState<MapPlace | null | undefined>(undefined);
  const [entities, setEntities] = useState<MapEntityLocation[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [relatedContent, setRelatedContent] = useState<OwnedMapContent>({
    markers: [],
    connections: [],
  });
  const [error, setError] = useState("");
  const [radius, setRadius] = useState(radiusKm);
  const [types, setTypes] =
    useState<MapEntityLocation["entityType"][]>(entityTypes);
  const [sourceRoles, setSourceRoles] = useState<SourceLocationRole[]>([]);
  const [sourcePeriod, setSourcePeriod] = useState("");
  const [sourceClassification, setSourceClassification] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [sourceFrom, setSourceFrom] = useState<HistoricalYearInput>({
    year: "",
    era: "AD",
  });
  const [sourceTo, setSourceTo] = useState<HistoricalYearInput>({
    year: "",
    era: "AD",
  });
  const [eventPeriod, setEventPeriod] = useState("");
  const [eventFrom, setEventFrom] = useState<HistoricalYearInput>({
    year: "",
    era: "AD",
  });
  const [eventTo, setEventTo] = useState<HistoricalYearInput>({
    year: "",
    era: "AD",
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!show) return undefined;
    const controller = new AbortController();
    setPlace(undefined);
    setEntities([]);
    setThumbnails({});
    setRelatedContent({ markers: [], connections: [] });
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
    if (!show || !loadRelatedMapContent) return undefined;
    let active = true;
    void loadRelatedMapContent()
      .then((content) => {
        if (active) setRelatedContent(content);
      })
      // The nearby map remains useful even if an optional page relationship
      // read is unavailable, so avoid turning this into a blocking modal error.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [loadRelatedMapContent, show]);

  const sourceFilters: MapSourceFilters = useMemo(
    () => ({
      ...(sourcePeriod ? { period: sourcePeriod } : {}),
      ...(sourceClassification
        ? { classifications: [sourceClassification] }
        : {}),
      ...(sourceType ? { types: [sourceType] } : {}),
      ...(toAstronomicalYear(sourceFrom) !== undefined
        ? { from: toAstronomicalYear(sourceFrom) }
        : {}),
      ...(toAstronomicalYear(sourceTo) !== undefined
        ? { to: toAstronomicalYear(sourceTo) }
        : {}),
    }),
    [sourceClassification, sourceFrom, sourcePeriod, sourceTo, sourceType],
  );
  const eventFilters: MapEventFilters = useMemo(
    () => ({
      ...(eventPeriod ? { period: eventPeriod } : {}),
      ...(toAstronomicalYear(eventFrom) !== undefined
        ? { from: toAstronomicalYear(eventFrom) }
        : {}),
      ...(toAstronomicalYear(eventTo) !== undefined
        ? { to: toAstronomicalYear(eventTo) }
        : {}),
    }),
    [eventFrom, eventPeriod, eventTo],
  );

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
      sourceRoles,
      sourceFilters,
      eventFilters,
    )
      .then((nearby) => {
        if (!controller.signal.aborted) setEntities(nearby);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError((caught as Error).message || "Unable to load related map.");
      });
    return () => controller.abort();
  }, [eventFilters, place, radius, show, sourceFilters, sourceRoles, types]);

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

  const relatedMarkerKeys = new Set(
    relatedContent.markers.map((marker) => marker.key),
  );
  const thumbnailMarkers: MapThumbnailMarker[] = entities
    .filter(
      (entity) =>
        !relatedMarkerKeys.has(
          `${entity.entityType}:${entity.entityId}:${entity.locationRole}`,
        ),
    )
    .map((entity) => ({
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
  const fitPoints = [
    ...(place
      ? [
          {
            key: `PLACE:${place.id}`,
            latitude: place.latitude,
            longitude: place.longitude,
          },
        ]
      : []),
    ...relatedContent.markers,
  ];

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
                <div className="related-map-filter-controls">
                  <MapEntityFilterControls
                    idPrefix={`related-map-${place.id}`}
                    compact
                    entityTypes={types}
                    onEntityTypesChange={setTypes}
                    sourceRoles={sourceRoles}
                    onSourceRolesChange={setSourceRoles}
                    sourcePeriod={sourcePeriod}
                    onSourcePeriodChange={setSourcePeriod}
                    sourceClassification={sourceClassification}
                    onSourceClassificationChange={setSourceClassification}
                    sourceType={sourceType}
                    onSourceTypeChange={setSourceType}
                    sourceFrom={sourceFrom}
                    onSourceFromChange={setSourceFrom}
                    sourceTo={sourceTo}
                    onSourceToChange={setSourceTo}
                    eventPeriod={eventPeriod}
                    onEventPeriodChange={setEventPeriod}
                    eventFrom={eventFrom}
                    onEventFromChange={setEventFrom}
                    eventTo={eventTo}
                    onEventToChange={setEventTo}
                  />
                </div>
              </div>
              <p className="small text-muted">
                Public content within {radius} km of this location.
                {relatedContent.markers.length
                  ? ` This ${relatedContent.markers.length === 1 ? "related item is" : `${relatedContent.markers.length} related items are`} shown with connection lines.`
                  : ""}
              </p>
              <div className="related-map-canvas">
                <MapCanvas
                  places={[{ ...place, matchedName: displayName }]}
                  entities={entities}
                  thumbnailMarkers={thumbnailMarkers}
                  ownedMarkers={relatedContent.markers}
                  ownedConnections={relatedContent.connections}
                  focus={relatedContent.markers.length ? null : place}
                  initialFitPoints={fitPoints}
                  selectedPlaceId={place.id}
                  showModernBorders={false}
                  onEntitySelect={() => undefined}
                  onThumbnailMarkerSelect={(marker) =>
                    navigate(entityPath(marker.entityType, marker.entityId))
                  }
                  onOwnedMarkerSelect={(marker) => navigate(marker.path)}
                  onMapError={setError}
                />
              </div>
            </>
          )}
        </Modal.Body>
        {place && (
          <Modal.Footer>
            <Button
              variant="outline-dark"
              onClick={() => {
                setShow(false);
                navigate(
                  `/map?${new URLSearchParams({
                    placeId: place.id,
                    q: displayName,
                    lat: String(place.latitude),
                    lng: String(place.longitude),
                    radiusKm: String(radius),
                  }).toString()}`,
                );
              }}
            >
              Open in Map
            </Button>
          </Modal.Footer>
        )}
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

function toAstronomicalYear(value: HistoricalYearInput): number | undefined {
  if (!value.year || !/^[1-9][0-9]*$/.test(value.year)) return undefined;
  const year = Number(value.year);
  return value.era === "BC" ? 1 - year : year;
}
