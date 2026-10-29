import { useEffect, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";

import MapCanvas from "./MapCanvas";
import { saveMapSnapshot, type MapEntityLocation } from "./mapApi";
import { stageMapAttachment } from "./pendingMapAttachment";
import { loadSharedMapScope, type OwnedMapContent } from "./ownedMapContent";
import type { SharedMapScope } from "./sharedMapScope";

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
    ...(scopeId && scopeType ? { scope: { type: scopeType as SharedMapScope["type"], id: scopeId } } : {}),
  };
}

export default function MapReferenceAttachment({
  reference,
  className = "",
}: {
  reference: PublicMapReference;
  className?: string;
}) {
  const [mapError, setMapError] = useState(false);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState("");
  const navigate = useNavigate();
  const path = publicMapReferencePath(reference);
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
  return (
    <>
      <section className={`map-reference-attachment ${className}`.trim()} aria-label={`Map: ${name}`}>
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
          {!mapError && <MapPreview reference={reference} onError={() => setMapError(true)} />}
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
        <Modal.Header closeButton><Modal.Title>{name}</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className="map-reference-modal-canvas">
            <MapPreview reference={reference} onError={() => setStatus("Map preview unavailable.")} />
          </div>
          {status && <p className="small text-muted mt-2 mb-0">{status}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-dark" onClick={() => { setShow(false); navigate(path); }}>Open in Map</Button>
          <Button variant="outline-dark" onClick={() => void copy()}>Copy link</Button>
          <Button variant="outline-dark" onClick={() => void save()}>Save map</Button>
          <Button variant="dark" onClick={() => { stageMapAttachment(reference); setShow(false); navigate("/chat", { state: { composeMap: true } }); }}>Send</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function MapPreview({ reference, onError }: { reference: PublicMapReference; onError: () => void }) {
  const [content, setContent] = useState<OwnedMapContent>({ markers: [], connections: [] });
  useEffect(() => {
    let active = true;
    if (!reference.scope) {
      setContent({ markers: [], connections: [] });
      return () => { active = false; };
    }
    void loadSharedMapScope(reference.scope)
      .then((next) => { if (active) setContent(next); })
      .catch(onError);
    return () => { active = false; };
  }, [reference.scope, onError]);
  const fitPoints = content.markers.length
    ? content.markers.map((marker) => ({ key: marker.key, latitude: marker.latitude, longitude: marker.longitude }))
    : [{ key: "map-reference-focus", latitude: reference.latitude, longitude: reference.longitude }];
  return <div className="map-reference-canvas"><MapCanvas places={[]} entities={[]} ownedMarkers={content.markers} ownedConnections={content.connections} focus={content.markers.length ? null : { latitude: reference.latitude, longitude: reference.longitude }} pickedCoordinate={content.markers.length ? null : { latitude: reference.latitude, longitude: reference.longitude }} initialFitPoints={fitPoints} showModernBorders={false} onEntitySelect={() => undefined} onMapError={onError} /></div>;
}

function isScopeType(value: string | null): value is SharedMapScope["type"] {
  return value === "USER" || value === "PROFILE" || value === "CLUB" || value === "EVENT" || value === "SOURCE";
}
