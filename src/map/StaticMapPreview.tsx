import { useEffect, useRef, useState } from "react";

import type { MapEntityLocation } from "./mapApi";
import type { OwnedMapConnection, OwnedMapMarker } from "./ownedMapContent";
import type { PublicMapReference } from "./MapReferenceAttachment";

type BasemapFeature = {
  geometry?: {
    type?: "Polygon" | "MultiPolygon" | "LineString" | "MultiLineString";
    coordinates?: unknown;
  };
  properties?: { tempvsBasemapKind?: "land" | "lakes" | "borders" };
};

type Basemap = { features?: BasemapFeature[] };

let basemapRequest: Promise<Basemap> | null = null;

function loadBasemap() {
  basemapRequest ||= fetch("/maps/basemap.geojson")
    .then((response) => {
      if (!response.ok) throw new Error("Unable to load map preview");
      return response.json() as Promise<Basemap>;
    })
    .catch((error) => {
      basemapRequest = null;
      throw error;
    });
  return basemapRequest;
}

type Point = { latitude: number; longitude: number };

const width = 960;
const height = 480;

/** A deliberately lightweight geographic preview for feed cards. It uses the
 * same local Natural Earth source and the attachment's actual graph, while
 * avoiding a MapLibre/WebGL instance for every visible post. */
export default function StaticMapPreview({
  reference,
  markers,
  entities,
  connections,
}: {
  reference: PublicMapReference;
  markers: OwnedMapMarker[];
  entities: MapEntityLocation[];
  connections: OwnedMapConnection[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [basemap, setBasemap] = useState<Basemap | null>(null);

  useEffect(() => {
    let active = true;
    void loadBasemap()
      .then((next) => {
        if (active) setBasemap(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !basemap) return;
    drawPreview(canvas, basemap, reference, markers, entities, connections);
  }, [basemap, connections, entities, markers, reference]);

  return (
    <canvas
      ref={canvasRef}
      className="static-map-preview"
      width={width}
      height={height}
      aria-label="Map preview"
    />
  );
}

function drawPreview(
  canvas: HTMLCanvasElement,
  basemap: Basemap,
  reference: PublicMapReference,
  markers: OwnedMapMarker[],
  entities: MapEntityLocation[],
  connections: OwnedMapConnection[],
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#b9d7e5";
  context.fillRect(0, 0, width, height);

  const points: Point[] = [
    { latitude: reference.latitude, longitude: reference.longitude },
    ...markers,
    ...entities,
  ].filter(validPoint);
  const bounds = previewBounds(reference, points);
  const project = ({ longitude, latitude }: Point): [number, number] => [
    ((longitude - bounds.west) / (bounds.east - bounds.west)) * width,
    ((bounds.north - latitude) / (bounds.north - bounds.south)) * height,
  ];

  for (const feature of basemap.features || []) {
    const kind = feature.properties?.tempvsBasemapKind;
    if (!kind || !feature.geometry?.coordinates) continue;
    context.beginPath();
    drawGeometry(context, feature.geometry, project);
    if (kind === "land") {
      context.fillStyle = "#eee7d6";
      context.strokeStyle = "#b4a98e";
      context.lineWidth = 1;
      context.fill();
      context.stroke();
    } else if (kind === "lakes") {
      context.fillStyle = "#b9d7e5";
      context.fill();
    } else {
      context.strokeStyle = "rgba(185, 175, 158, 0.7)";
      context.lineWidth = 1;
      context.stroke();
    }
  }

  const markerByKey = new Map(markers.map((marker) => [marker.key, marker]));
  context.setLineDash([10, 7]);
  context.lineWidth = 3;
  connections.forEach((connection) => {
    const from = markerByKey.get(connection.fromKey);
    const to = markerByKey.get(connection.toKey);
    if (!from || !to) return;
    const [fromX, fromY] = project(from);
    const [toX, toY] = project(to);
    context.strokeStyle = connectionColour(connection.kind);
    context.beginPath();
    if (Math.abs(fromX - toX) < 1 && Math.abs(fromY - toY) < 1) {
      context.arc(fromX, fromY - 16, 16, Math.PI / 2, Math.PI * 2.5);
    } else {
      context.moveTo(fromX, fromY);
      context.lineTo(toX, toY);
    }
    context.stroke();
  });
  context.setLineDash([]);

  markers.forEach((marker) => drawMarker(context, project(marker), marker.entityType));
  entities.forEach((entity) => drawMarker(context, project(entity), entity.entityType));
}

function previewBounds(reference: PublicMapReference, points: Point[]) {
  const baseLatitudeSpan = Math.max(reference.radiusKm / 111.32, 0.35) * 1.35;
  const baseLongitudeSpan =
    baseLatitudeSpan / Math.max(0.2, Math.cos((reference.latitude * Math.PI) / 180));
  let north = reference.latitude + baseLatitudeSpan;
  let south = reference.latitude - baseLatitudeSpan;
  let east = reference.longitude + baseLongitudeSpan;
  let west = reference.longitude - baseLongitudeSpan;
  points.forEach((point) => {
    north = Math.max(north, point.latitude);
    south = Math.min(south, point.latitude);
    east = Math.max(east, point.longitude);
    west = Math.min(west, point.longitude);
  });
  const latitudePadding = Math.max((north - south) * 0.12, 0.08);
  const longitudePadding = Math.max((east - west) * 0.12, 0.08);
  return {
    north: Math.min(90, north + latitudePadding),
    south: Math.max(-90, south - latitudePadding),
    east: Math.min(180, east + longitudePadding),
    west: Math.max(-180, west - longitudePadding),
  };
}

function drawGeometry(
  context: CanvasRenderingContext2D,
  geometry: NonNullable<BasemapFeature["geometry"]>,
  project: (point: Point) => [number, number],
) {
  const drawLine = (line: unknown) => {
    if (!Array.isArray(line)) return;
    line.forEach((coordinate, index) => {
      if (!Array.isArray(coordinate) || coordinate.length < 2) return;
      const [x, y] = project({ longitude: Number(coordinate[0]), latitude: Number(coordinate[1]) });
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
  };
  const coordinates = geometry.coordinates;
  if (geometry.type === "Polygon" || geometry.type === "MultiLineString") {
    (coordinates as unknown[]).forEach(drawLine);
  } else if (geometry.type === "MultiPolygon") {
    (coordinates as unknown[]).forEach((polygon) =>
      Array.isArray(polygon) && polygon.forEach(drawLine),
    );
  } else if (geometry.type === "LineString") {
    drawLine(coordinates);
  }
}

function drawMarker(
  context: CanvasRenderingContext2D,
  [x, y]: [number, number],
  type: MapEntityLocation["entityType"],
) {
  context.beginPath();
  context.arc(x, y, 7, 0, Math.PI * 2);
  context.fillStyle = markerColour(type);
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "#fffdf7";
  context.stroke();
}

function markerColour(type: MapEntityLocation["entityType"]) {
  return type === "PROFILE"
    ? "#4f6d7a"
    : type === "CLUB"
      ? "#8a5a44"
      : type === "EVENT"
        ? "#75618c"
        : "#6d7c4a";
}

function connectionColour(kind: OwnedMapConnection["kind"]) {
  return kind === "PROFILE_SOURCE"
    ? "#6d7c4a"
    : kind === "PROFILE_CLUB"
      ? "#8a5a44"
      : "#4f6d7a";
}

function validPoint(point: Point) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}
