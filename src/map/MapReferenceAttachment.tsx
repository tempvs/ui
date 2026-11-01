import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";

import MapCanvas from "./LazyMapCanvas";
import {
  nearbyMapEntitiesPage,
  saveMapSnapshot,
  type MapEntityLocation,
} from "./mapApi";
import { stageMapAttachment } from "./pendingMapAttachment";
import { loadSharedMapScope, type OwnedMapContent } from "./ownedMapContent";
import type { SharedMapScope } from "./sharedMapScope";
import { getViewer } from "../auth/viewerApi";

const entityTypes: MapEntityLocation["entityType"][] = [
  "PROFILE",
  "CLUB",
  "EVENT",
  "SOURCE",
];

/** A bounded map viewport that can be stored in a post or chat message.
 * Scope is an explicitly approved, shareable resource graph. The resource
 * APIs resolve it for the current recipient and omit unreadable data. */
export type PublicMapReference = {
  placeId?: string;
  placeName?: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  entityTypes: MapEntityLocation["entityType"][];
  query?: string;
  scope?: SharedMapScope;
};

export function publicMapReferencePath(reference: PublicMapReference): string {
  const params = new URLSearchParams({
    lat: String(reference.latitude),
    lng: String(reference.longitude),
    radiusKm: String(reference.radiusKm),
    types:
      reference.entityTypes.length === entityTypes.length
        ? "all"
        : reference.entityTypes.join(","),
  });
  if (reference.placeId) params.set("placeId", reference.placeId);
  if (reference.placeName) params.set("q", reference.placeName);
  if (reference.query) params.set("content", reference.query);
  if (reference.scope) {
    params.set("scope", reference.scope.type);
    params.set("scopeId", reference.scope.id);
  }
  return `/map?${params.toString()}`;
}

/** Parse a copied map URL into the shareable server-side attachment shape. */
export function publicMapReferenceFromUrl(
  value: string,
): PublicMapReference | null {
  const input = value.trim();
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin || url.pathname !== "/map")
    return null;
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lng"));
  const radiusKm = Number(url.searchParams.get("radiusKm") || 25);
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isFinite(radiusKm) ||
    radiusKm < 1 ||
    radiusKm > 200
  )
    return null;
  const parameterTypes = url.searchParams.get("types");
  const selectedTypes =
    !parameterTypes || parameterTypes === "all"
      ? entityTypes
      : parameterTypes
          .split(",")
          .filter((type): type is MapEntityLocation["entityType"] =>
            entityTypes.includes(type as MapEntityLocation["entityType"]),
          );
  if (!selectedTypes.length) return null;
  const text = (name: string, maximum: number) => {
    const next = url.searchParams.get(name)?.trim();
    return next && next.length <= maximum ? next : undefined;
  };
  const placeId = text("placeId", 256);
  const placeName = text("q", 200);
  const query = text("content", 200);
  const scopeType = url.searchParams.get("scope");
  const scopeId = url.searchParams.get("scopeId")?.trim();
  if ((scopeType || scopeId) && (!scopeId || !isScopeType(scopeType)))
    return null;
  return {
    ...(placeId ? { placeId } : {}),
    ...(placeName ? { placeName } : {}),
    latitude,
    longitude,
    radiusKm,
    entityTypes: Array.from(new Set(selectedTypes)),
    ...(query ? { query } : {}),
    ...(scopeId && scopeType
      ? { scope: { type: scopeType as SharedMapScope["type"], id: scopeId } }
      : {}),
  };
}

export default function MapReferenceAttachment({
  reference,
  className = "",
  relationshipScope,
}: {
  reference: PublicMapReference;
  className?: string;
  /**
   * A profile page establishes the public profile that owns its posts. Use
   * that relationship graph alongside a saved attachment's own scope so both
   * legacy and explicitly scoped attachments retain profile/source edges.
   */
  relationshipScope?: SharedMapScope;
}) {
  const [mapError, setMapError] = useState(false);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  // MapLibre creates a WebGL context per preview. On a phone, a post feed
  // containing several map attachments can otherwise monopolize the GPU while
  // the visitor is merely scrolling past it.
  const [deferPreview] = useState(isNarrowViewport);
  const navigate = useNavigate();
  const relationshipScopeType = relationshipScope?.type;
  const relationshipScopeId = relationshipScope?.id;
  const stableRelationshipScope = useMemo(
    () =>
      relationshipScopeType && relationshipScopeId
        ? { type: relationshipScopeType, id: relationshipScopeId }
        : undefined,
    [relationshipScopeId, relationshipScopeType],
  );
  const resolvedReference = useMemo(
    () =>
      reference.scope || !stableRelationshipScope
        ? reference
        : { ...reference, scope: stableRelationshipScope },
    [reference, stableRelationshipScope],
  );
  const path = publicMapReferencePath(resolvedReference);
  const name = reference.placeName || "Shared map";
  const save = async () => {
    const title = window.prompt("Name this saved map", name);
    if (!title?.trim()) return;
    try {
      await saveMapSnapshot({ title: title.trim(), reference });
      setStatus("Saved to your maps.");
    } catch {
      setStatus("Unable to save this map.");
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setStatus("Map link copied.");
    } catch {
      setStatus("Copy the link from the opened map instead.");
    }
  };
  useEffect(() => {
    if (!show) return undefined;
    let active = true;
    void getViewer()
      .then((viewer) => {
        if (active) setAuthenticated(Boolean(viewer));
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      });
    return () => {
      active = false;
    };
  }, [show]);
  return (
    <>
      <section
        className={`map-reference-attachment ${className}`.trim()}
        aria-label={`Map: ${name}`}
      >
        <div
          className="map-reference-open"
          role="button"
          tabIndex={0}
          onClick={() => setShow(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setShow(true);
            }
          }}
          aria-label={`Open shared map: ${name}`}
        >
          <div className="map-reference-heading">
            <strong>{name}</strong>
            <span className="text-muted small">
              {reference.radiusKm} km · {reference.entityTypes.length} layer
              {reference.entityTypes.length === 1 ? "" : "s"}
            </span>
          </div>
          {!mapError && !deferPreview && (
            <MapPreview
              reference={resolvedReference}
              supplementalScope={
                reference.scope ? stableRelationshipScope : undefined
              }
              onError={() => setMapError(true)}
            />
          )}
          {!mapError && deferPreview && (
            <div className="map-reference-deferred-preview" aria-hidden>
              <span>Tap to load the interactive map</span>
            </div>
          )}
          {mapError && (
            <p className="small text-muted mb-1 px-2">
              Map preview unavailable. Open the map for the full view.
            </p>
          )}
        </div>
        <Link to={path} className="map-reference-open-link">
          Open in Map
        </Link>
      </section>
      <Modal show={show} onHide={() => setShow(false)} centered size="xl">
        <Modal.Header closeButton>
          <Modal.Title>{name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="map-reference-modal-canvas">
            <MapPreview
              reference={resolvedReference}
              supplementalScope={
                reference.scope ? stableRelationshipScope : undefined
              }
              eager
              onError={() => setStatus("Map preview unavailable.")}
            />
          </div>
          {status && <p className="small text-muted mt-2 mb-0">{status}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-dark"
            onClick={() => {
              setShow(false);
              navigate(path);
            }}
          >
            Open in Map
          </Button>
          <Button variant="outline-dark" onClick={() => void copy()}>
            Copy link
          </Button>
          {authenticated && (
            <Button variant="outline-dark" onClick={() => void save()}>
              Save map
            </Button>
          )}
          {authenticated && (
            <Button
              variant="dark"
              onClick={() => {
                stageMapAttachment(reference);
                setShow(false);
                navigate("/chat", { state: { composeMap: true } });
              }}
            >
              Send
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
}

function MapPreview({
  reference,
  supplementalScope,
  eager = false,
  onError,
}: {
  reference: PublicMapReference;
  supplementalScope?: SharedMapScope;
  eager?: boolean;
  onError: () => void;
}) {
  const [content, setContent] = useState<OwnedMapContent>({
    markers: [],
    connections: [],
  });
  const [entities, setEntities] = useState<MapEntityLocation[]>([]);
  const [contentReady, setContentReady] = useState(false);
  const [visible, setVisible] = useState(
    () => eager || typeof IntersectionObserver === "undefined",
  );
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (visible || typeof IntersectionObserver === "undefined") return;
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "160px 0px" },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [eager, visible]);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setContentReady(false);
    setContent({ markers: [], connections: [] });
    setEntities([]);
    // A scoped snapshot already describes the exact public graph being
    // shared. Loading the generic nearby layer as well is redundant and, on a
    // club wall with several embedded maps, creates an avoidable Map API
    // request burst. Unscoped copied map links retain nearby discovery.
    if (reference.scope) {
      const scopes = [reference.scope, supplementalScope].filter(
        (scope): scope is SharedMapScope => Boolean(scope),
      );
      const uniqueScopes = Array.from(
        new Map(scopes.map((scope) => [`${scope.type}:${scope.id}`, scope])),
      ).map(([, scope]) => scope);
      void Promise.all(uniqueScopes.map(loadSharedMapScope))
        .then((parts) => {
          if (active) {
            setContent(mergeMapContent(parts));
            setContentReady(true);
          }
        })
        .catch(() => {
          if (active) setContentReady(true);
          onError();
        });
    } else {
      void nearbyMapEntitiesPage(
        reference.latitude,
        reference.longitude,
        reference.radiusKm,
        reference.entityTypes,
      )
        .then((page) => {
          if (active) {
            setEntities(page.items);
            setContentReady(true);
          }
        })
        .catch(() => {
          if (active) setContentReady(true);
          onError();
        });
    }
    return () => {
      active = false;
    };
  }, [
    reference,
    onError,
    supplementalScope,
    visible,
  ]);
  const fitPoints = embeddedMapFitPoints(reference, content, entities);
  const hasVisibleMapContent = content.markers.length > 0 || entities.length > 0;
  return (
    <div ref={rootRef} className="map-reference-canvas">
      {visible && (
        <MapCanvas
          places={[]}
          entities={entities}
          ownedMarkers={content.markers}
          ownedConnections={content.connections}
          focus={
            contentReady && hasVisibleMapContent
              ? null
              : { latitude: reference.latitude, longitude: reference.longitude }
          }
          pickedCoordinate={
            contentReady && hasVisibleMapContent
              ? null
              : { latitude: reference.latitude, longitude: reference.longitude }
          }
          initialFitPoints={contentReady ? fitPoints : []}
          initialFitDelayMs={450}
          showModernBorders={false}
          onEntitySelect={() => undefined}
          onMapError={onError}
        />
      )}
    </div>
  );
}

function isNarrowViewport() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 767.98px)").matches
  );
}

/** Keep each attachment's saved map context while adding a profile relation
 * graph. Keys are stable resource/location identifiers, so de-duplication is
 * deterministic even where both scopes include the same marker or edge. */
export function mergeMapContent(parts: OwnedMapContent[]): OwnedMapContent {
  return {
    markers: Array.from(
      new Map(parts.flatMap((part) => part.markers.map((marker) => [marker.key, marker]))).values(),
    ),
    connections: Array.from(
      new Map(parts.flatMap((part) => part.connections.map((edge) => [edge.key, edge]))).values(),
    ),
  };
}

/**
 * A map reference can resolve to either an explicitly shared graph or public
 * nearby entities. Both sets must take part in the viewport calculation:
 * fitting only the saved centre leaves distant, valid markers outside an
 * embedded preview.
 */
export function embeddedMapFitPoints(
  reference: PublicMapReference,
  content: OwnedMapContent,
  entities: MapEntityLocation[],
) {
  const points = [
    ...content.markers.map((marker) => ({
      key: marker.key,
      latitude: marker.latitude,
      longitude: marker.longitude,
    })),
    ...entities.map((entity) => ({
      key: `ENTITY:${entity.entityType}:${entity.entityId}:${entity.locationRole}:${entity.placeId}`,
      latitude: entity.latitude,
      longitude: entity.longitude,
    })),
  ].filter(
    (point) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude),
  );

  return points.length
    ? points
    : [
        {
          key: "map-reference-focus",
          latitude: reference.latitude,
          longitude: reference.longitude,
        },
      ];
}

function isScopeType(value: string | null): value is SharedMapScope["type"] {
  return (
    value === "USER" ||
    value === "PROFILE" ||
    value === "CLUB" ||
    value === "EVENT" ||
    value === "SOURCE"
  );
}
