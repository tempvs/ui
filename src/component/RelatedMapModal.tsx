import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { FaGlobeAmericas } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { getImageThumbnails } from "../image/imageApi";
import MapCanvas from "../map/MapCanvas";
import { entityThumbnailMarkers } from "../map/entityThumbnailMarkers";
import type { OwnedMapContent } from "../map/ownedMapContent";
import {
  appendSharedMapScope,
  type SharedMapScope,
} from "../map/sharedMapScope";
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
  /** Page-scoped relation data (for example a profile's public clubs/sources).
   * This intentionally never becomes part of the public nearby-map endpoint. */
  loadRelatedMapContent?: () => Promise<OwnedMapContent>;
  /** Makes the full-map URL reproduce this public page's relationship slice. */
  scope?: SharedMapScope;
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
  scope,
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
  const [types, setTypes] =
    useState<MapEntityLocation["entityType"][]>(entityTypes);
  const [showNearby, setShowNearby] = useState(true);
  const [showRelated, setShowRelated] = useState(true);
  const [copied, setCopied] = useState(false);
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

  useEffect(() => {
    if (!show || !place) return undefined;
    if (!showNearby || !types.length) {
      setEntities([]);
      return undefined;
    }
    const controller = new AbortController();
    void nearbyMapEntities(
      place.latitude,
      place.longitude,
      radiusKm,
      types,
      "",
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
  }, [
    place,
    radiusKm,
    show,
    showNearby,
    types,
  ]);

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

  const visibleRelatedContent = useMemo<OwnedMapContent>(
    () =>
      showRelated
        ? relatedContent
        : { markers: [], connections: [] },
    [relatedContent, showRelated],
  );
  const relatedMarkerKeys = new Set(
    visibleRelatedContent.markers.map((marker) => marker.key),
  );
  const thumbnailMarkers = entityThumbnailMarkers(
    entities,
    thumbnails,
    relatedMarkerKeys,
  );
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
    ...visibleRelatedContent.markers,
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
              <div className="d-flex align-items-center gap-3 flex-wrap mb-2">
                <span className="small fw-semibold">Layers</span>
                <Form.Check
                  id={`related-map-nearby-${place.id}`}
                  label={`Nearby public content (${radiusKm} km)`}
                  checked={showNearby}
                  onChange={(event) => setShowNearby(event.target.checked)}
                />
                {loadRelatedMapContent && (
                  <Form.Check
                    id={`related-map-scope-${place.id}`}
                    label="This page's related content"
                    checked={showRelated}
                    onChange={(event) => setShowRelated(event.target.checked)}
                  />
                )}
                {entityTypes.map((type) => (
                  <Form.Check
                    key={type}
                    id={`related-map-type-${place.id}-${type}`}
                    label={`${type[0]}${type.slice(1).toLowerCase()}s`}
                    checked={types.includes(type)}
                    onChange={(event) =>
                      setTypes((current) =>
                        event.target.checked
                          ? [...current, type]
                          : current.filter((value) => value !== type),
                      )
                    }
                  />
                ))}
              </div>
              <p className="small text-muted">
                {showNearby ? `Public content within ${radiusKm} km of this location.` : "Nearby public content is hidden."}
                {visibleRelatedContent.markers.length
                  ? ` This ${visibleRelatedContent.markers.length === 1 ? "related item is" : `${visibleRelatedContent.markers.length} related items are`} shown with connection lines.`
                  : ""}
              </p>
              <div className="related-map-canvas">
                <MapCanvas
                  places={[{ ...place, matchedName: displayName }]}
                  entities={entities}
                  thumbnailMarkers={thumbnailMarkers}
                  ownedMarkers={visibleRelatedContent.markers}
                  ownedConnections={visibleRelatedContent.connections}
                  focus={visibleRelatedContent.markers.length ? null : place}
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
                const path = `/map?${appendSharedMapScope(
                  fullMapParameters(place, displayName, radiusKm, types),
                  scope,
                ).toString()}`;
                setShow(false);
                navigate(path);
              }}
            >
              Open in Map
            </Button>
            <Button
              variant="outline-dark"
              onClick={() => {
                const path = `/map?${appendSharedMapScope(
                  fullMapParameters(place, displayName, radiusKm, types),
                  scope,
                ).toString()}`;
                void navigator.clipboard?.writeText(`${window.location.origin}${path}`)
                  .then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2500);
                  })
                  .catch(() => setCopied(false));
              }}
            >
              {copied ? "Copied" : "Copy map link"}
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

function fullMapParameters(
  place: MapPlace,
  displayName: string,
  radius: number,
  types: MapEntityLocation["entityType"][],
): URLSearchParams {
  return new URLSearchParams({
    placeId: place.id,
    q: displayName,
    lat: String(place.latitude),
    lng: String(place.longitude),
    radiusKm: String(radius),
    types: types.length === 0 ? "none" : types.length === entityTypes.length ? "all" : types.join(","),
  });
}
