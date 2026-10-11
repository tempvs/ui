import { useState } from "react";
import { Link } from "react-router-dom";

import MapCanvas from "./MapCanvas";
import type { MapEntityLocation } from "./mapApi";

const entityTypes: MapEntityLocation["entityType"][] = [
  "PROFILE",
  "CLUB",
  "EVENT",
  "SOURCE",
];

/** Deliberately public, bounded data that can be stored in a post or chat
 * message. It cannot contain the `scope` parameters used by personal/page
 * relationship overlays or an arbitrary private coordinate. */
export type PublicMapReference = {
  placeId?: string;
  placeName?: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  entityTypes: MapEntityLocation["entityType"][];
  query?: string;
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
  return `/map?${params.toString()}`;
}

/** Parse a copied public Map URL into the safe server-side attachment shape.
 * Scopes are deliberately rejected: they may render relationship overlays that
 * are appropriate only on an originating page, never in stored content. */
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
  if (url.searchParams.has("scope") || url.searchParams.has("scopeId"))
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
  return {
    ...(placeId ? { placeId } : {}),
    ...(placeName ? { placeName } : {}),
    latitude,
    longitude,
    radiusKm,
    entityTypes: Array.from(new Set(selectedTypes)),
    ...(query ? { query } : {}),
  };
}

export default function MapReferenceAttachment({
  reference,
}: {
  reference: PublicMapReference;
}) {
  const [mapError, setMapError] = useState(false);
  const path = publicMapReferencePath(reference);
  const name = reference.placeName || "Shared map";
  return (
    <section className="map-reference-attachment" aria-label={`Map: ${name}`}>
      <div className="map-reference-heading">
        <strong>{name}</strong>
        <span className="text-muted small">
          {reference.radiusKm} km · {reference.entityTypes.length} layer
          {reference.entityTypes.length === 1 ? "" : "s"}
        </span>
      </div>
      {!mapError && (
        <div className="map-reference-canvas">
          <MapCanvas
            places={[]}
            entities={[]}
            focus={{
              latitude: reference.latitude,
              longitude: reference.longitude,
            }}
            pickedCoordinate={{
              latitude: reference.latitude,
              longitude: reference.longitude,
            }}
            initialFitPoints={[
              {
                key: "map-reference-focus",
                latitude: reference.latitude,
                longitude: reference.longitude,
              },
            ]}
            showModernBorders={false}
            onEntitySelect={() => undefined}
            onMapError={() => setMapError(true)}
          />
        </div>
      )}
      {mapError && (
        <p className="small text-muted mb-1">
          Map preview unavailable. The public map link remains available.
        </p>
      )}
      <Link to={path} className="small">
        Open in Map
      </Link>
    </section>
  );
}
