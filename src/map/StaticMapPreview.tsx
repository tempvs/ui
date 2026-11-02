import { useEffect, useMemo, useRef, useState } from "react";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const [basemap, setBasemap] = useState<Basemap | null>(null);
  const [size, setSize] = useState({ width: 960, height: 480 });
  const points = useMemo<Point[]>(
    () => [
      { latitude: reference.latitude, longitude: reference.longitude },
      ...markers,
      ...entities,
    ].filter(validPoint),
    [entities, markers, reference.latitude, reference.longitude],
  );
  const bounds = useMemo(
    () => previewBounds(reference, points),
    [points, reference],
  );
  const markerOffsets = useMemo(() => thumbnailOffsets(markers), [markers]);

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
    const root = rootRef.current;
    if (!root) return undefined;
    const measure = () => {
      const next = root.getBoundingClientRect();
      if (next.width > 0 && next.height > 0)
        setSize({ width: Math.round(next.width), height: Math.round(next.height) });
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(root);
    measure();
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !basemap) return;
    drawPreview(canvas, basemap, reference, markers, entities, connections, bounds);
  }, [basemap, bounds, connections, entities, markers, reference, size]);

  return (
    <div ref={rootRef} className="static-map-preview" aria-label="Map preview">
      <canvas
        ref={canvasRef}
        className="static-map-preview-canvas"
        width={size.width}
        height={size.height}
      />
      {markers.map((marker) =>
        marker.thumbnailUrl ? (
          <img
            key={marker.key}
            className={`static-map-preview-thumbnail static-map-preview-thumbnail-${marker.entityType.toLowerCase()}`}
            src={marker.thumbnailUrl}
            alt=""
            style={thumbnailPosition(marker, bounds, markerOffsets.get(marker.key))}
          />
        ) : null,
      )}
    </div>
  );
}

function drawPreview(
  canvas: HTMLCanvasElement,
  basemap: Basemap,
  reference: PublicMapReference,
  markers: OwnedMapMarker[],
  entities: MapEntityLocation[],
  connections: OwnedMapConnection[],
  bounds: ReturnType<typeof previewBounds>,
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const { width, height } = canvas;
  context.fillStyle = "#b9d7e5";
  context.fillRect(0, 0, width, height);

  const project = ({ longitude, latitude }: Point): [number, number] => [
    ((longitude - bounds.west) / (bounds.east - bounds.west)) * width,
    ((bounds.north - latitude) / (bounds.north - bounds.south)) * height,
  ];

  for (const feature of basemap.features || []) {
    const kind = feature.properties?.tempvsBasemapKind;
    if (!kind || kind === "borders" || !feature.geometry?.coordinates) continue;
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

function thumbnailPosition(
  point: Point,
  bounds: ReturnType<typeof previewBounds>,
  offset: [number, number] = [0, 0],
) {
  const left = ((point.longitude - bounds.west) / (bounds.east - bounds.west)) * 100;
  const top = ((bounds.north - point.latitude) / (bounds.north - bounds.south)) * 100;
  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: `translate(calc(-50% + ${offset[0]}px), calc(-50% + ${offset[1]}px))`,
  };
}

function thumbnailOffsets(markers: OwnedMapMarker[]) {
  const grouped = new Map<string, OwnedMapMarker[]>();
  markers.forEach((marker) => {
    const group = grouped.get(marker.placeId) || [];
    group.push(marker);
    grouped.set(marker.placeId, group);
  });
  const offsets = new Map<string, [number, number]>();
  grouped.forEach((group) => {
    group.forEach((marker, index) => {
      if (group.length === 1) offsets.set(marker.key, [0, 0]);
      else {
        const angle = (Math.PI * 2 * index) / group.length - Math.PI / 2;
        offsets.set(marker.key, [
          Math.round(Math.cos(angle) * 20),
          Math.round(Math.sin(angle) * 20),
        ]);
      }
    });
  });
  return offsets;
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
