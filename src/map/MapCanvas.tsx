import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  getMapPlacesByReference,
  mapPlaceReference,
  type MapEntityLocation,
  type MapPlace,
} from "./mapApi";
import type { OwnedMapConnection, OwnedMapMarker } from "./ownedMapContent";
import { formatPlaceNameRange } from "./placeNames";
import "./map.css";

/** Required attribution for the bundled Natural Earth reference basemap. */
export const MAP_ATTRIBUTION = "Made with Natural Earth";

export type MapCanvasProps = {
  places: MapPlace[];
  entities: MapEntityLocation[];
  /** Viewer-scoped markers assembled in the browser. They are kept out of
   * the public entity source because membership/ownership is private context. */
  ownedMarkers?: OwnedMapMarker[];
  /** Image markers for a deliberately bounded public result set, such as the
   * related-location modal. Keeping these separate from the clustered public
   * source means broad Map-page searches remain inexpensive. */
  thumbnailMarkers?: MapThumbnailMarker[];
  /** Viewer-scoped relationship edges between the private overlay markers. */
  ownedConnections?: OwnedMapConnection[];
  focus?: { latitude: number; longitude: number } | null;
  /** Private viewer markers to frame when the map first opens without a
   * public search. This keeps a member's distributed profiles/clubs/sources
   * visible together instead of zooming to whichever request finished first. */
  initialFitPoints?: Array<{
    key: string;
    latitude: number;
    longitude: number;
  }>;
  /** Embedded attachments wait for their batched marker graph and a settled
   * layout before framing it, avoiding a first-marker-only viewport. */
  initialFitDelayMs?: number;
  showModernBorders: boolean;
  selectedEntityKey?: string | null;
  /** The one place deliberately chosen from map search. Its matched name is
   * rendered beside the pin instead of labelling every nearby result. */
  selectedPlaceId?: string | null;
  pickedCoordinate?: { latitude: number; longitude: number } | null;
  onEntitySelect: (key: string) => void;
  onPlaceSelect?: (place: MapPlace) => void;
  onCoordinatePick?: (coordinate: {
    latitude: number;
    longitude: number;
  }) => void;
  onOwnedMarkerSelect?: (marker: OwnedMapMarker) => void;
  onThumbnailMarkerSelect?: (marker: MapThumbnailMarker) => void;
  onMapError: (message: string) => void;
};

export type MapThumbnailMarker = {
  key: string;
  entityType: MapEntityLocation["entityType"];
  entityId: string;
  locationRole: MapEntityLocation["locationRole"];
  label: string;
  placeId: string;
  placeName: string;
  latitude: number;
  longitude: number;
  thumbnailUrl?: string | null;
};

type MarkerProperties = {
  key: string;
  kind: "PLACE" | MapEntityLocation["entityType"];
  label: string;
  role?: string;
  entityId?: string;
  placeId?: string;
  /** Alias when available, otherwise a UUID; used for stable public links. */
  placeReference?: string;
  placeName?: string;
};

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const BASEMAP_URL = "/maps/basemap.geojson";
let basemapPreload: Promise<void> | undefined;

/** Start warming the complete self-hosted world before MapLibre asks for its
 * style source. Every modal and the full Map page then use the same cached
 * land/lake/border payload instead of revealing it piecemeal while panning. */
function preloadBasemap(): Promise<void> {
  if (!basemapPreload) {
    basemapPreload = fetch(BASEMAP_URL, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to preload map basemap");
        return response.arrayBuffer();
      })
      .then(() => undefined)
      .catch(() => undefined);
  }
  return basemapPreload;
}

void preloadBasemap();

/**
 * A deliberately small, self-hosted Natural Earth style. The background is the
 * ocean; land, lakes and country boundaries are one static public-domain GeoJSON.
 * Dynamic Map API results are the only per-request source.
 */
export default function MapCanvas({
  places,
  entities,
  ownedMarkers = [],
  thumbnailMarkers = [],
  ownedConnections = [],
  focus,
  initialFitPoints = [],
  initialFitDelayMs = 0,
  showModernBorders,
  selectedEntityKey = null,
  selectedPlaceId = null,
  pickedCoordinate = null,
  onEntitySelect,
  onPlaceSelect,
  onCoordinatePick,
  onOwnedMarkerSelect,
  onThumbnailMarkerSelect,
  onMapError,
}: MapCanvasProps) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const selectedPlaceMarker = useRef<maplibregl.Marker | null>(null);
  const coordinateMarker = useRef<maplibregl.Marker | null>(null);
  const ownedMarkerInstances = useRef<maplibregl.Marker[]>([]);
  const initialOwnedMarkers = useRef(ownedMarkers);
  const initialOwnedConnections = useRef(ownedConnections);
  const fittedPrivateMarkerSignature = useRef<string | null>(null);
  const selectRef = useRef(onEntitySelect);
  const placeSelectRef = useRef(onPlaceSelect);
  const ownedMarkerSelectRef = useRef(onOwnedMarkerSelect);
  const thumbnailMarkerSelectRef = useRef(onThumbnailMarkerSelect);
  const coordinatePickRef = useRef(onCoordinatePick);
  const placesRef = useRef(places);
  const errorRef = useRef(onMapError);
  const [ready, setReady] = useState(false);
  const [placeReferences, setPlaceReferences] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    selectRef.current = onEntitySelect;
    placeSelectRef.current = onPlaceSelect;
    ownedMarkerSelectRef.current = onOwnedMarkerSelect;
    thumbnailMarkerSelectRef.current = onThumbnailMarkerSelect;
    coordinatePickRef.current = onCoordinatePick;
    errorRef.current = onMapError;
  }, [
    onCoordinatePick,
    onEntitySelect,
    onMapError,
    onOwnedMarkerSelect,
    onThumbnailMarkerSelect,
    onPlaceSelect,
  ]);

  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  useEffect(() => {
    const ids = Array.from(
      new Set([
        ...entities.map((entity) => entity.placeId),
        ...ownedMarkers.map((marker) => marker.placeId),
        ...thumbnailMarkers.map((marker) => marker.placeId),
      ]),
    ).filter(Boolean);
    if (!ids.length) {
      setPlaceReferences(new Map());
      return;
    }
    let active = true;
    void getMapPlacesByReference(ids)
      .then((resolved) => {
        if (!active) return;
        setPlaceReferences(
          new Map(
            ids.flatMap((id) => {
              const place = resolved.get(id);
              return place ? [[id, mapPlaceReference(place)] as const] : [];
            }),
          ),
        );
      })
      .catch(() => {
        if (active) setPlaceReferences(new Map());
      });
    return () => {
      active = false;
    };
  }, [entities, ownedMarkers, thumbnailMarkers]);

  useEffect(() => {
    if (!element.current || map.current) return undefined;
    let active = true;
    const next = new maplibregl.Map({
      container: element.current,
      style: mapStyle(),
      center: [10, 24],
      zoom: 1.1,
      minZoom: 0,
      maxZoom: 12,
      // Keep a complete world available when a user pans a compact modal or
      // the full Map page. Being explicit avoids blank copies at the
      // antimeridian while the self-hosted GeoJSON basemap is in use.
      renderWorldCopies: true,
      // The historical map is a north-up reference surface. Keep ordinary
      // mouse/touch dragging for panning, but never let a gesture tilt or
      // rotate the world beneath its markers.
      bearing: 0,
      pitch: 0,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: false,
    });
    map.current = next;
    // Disable the gesture handlers as well as their constructor options. This
    // covers trackpad right-click/two-finger rotation in every MapLibre view,
    // including the small related-location modals.
    next.dragRotate.disable();
    next.touchZoomRotate.disableRotation();
    next.touchPitch.disable();
    next.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    next.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: MAP_ATTRIBUTION,
      }),
    );
    next.on("error", (event) => {
      const message = event.error?.message || "The map could not be displayed.";
      if (!/source .* is not loaded/i.test(message)) errorRef.current(message);
    });
    next.on("click", (event) => {
      coordinatePickRef.current?.({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    });
    next.on("load", () => {
      if (!active) return;
      addMarkerLayers(
        next,
        (key) => selectRef.current(key),
        (id) => {
          const place = placesRef.current.find((item) => item.id === id);
          if (place) placeSelectRef.current?.(place);
          return place;
        },
        initialOwnedConnections.current,
        initialOwnedMarkers.current,
      );
      setReady(true);
      // The modal has finished its CSS transition by now, but the GeoJSON
      // source can finish painting one frame later. Re-measure at idle so the
      // complete world is redrawn into the final viewport rather than keeping
      // a clipped WebGL buffer from the transition frame.
      const resizeWhenIdle = () => {
        if (active) next.resize();
      };
      next.once("idle", resizeWhenIdle);
      next.once("remove", () => next.off("idle", resizeWhenIdle));
    });
    return () => {
      active = false;
      selectedPlaceMarker.current?.remove();
      selectedPlaceMarker.current = null;
      coordinateMarker.current?.remove();
      coordinateMarker.current = null;
      ownedMarkerInstances.current.forEach((marker) => marker.remove());
      ownedMarkerInstances.current = [];
      next.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const container = element.current;
    if (!container) return undefined;
    let frame: number | undefined;
    const resize = () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        // MapLibre does not automatically learn about a Bootstrap modal's
        // transition or a responsive column changing width. Without this its
        // WebGL viewport keeps stale dimensions and clips while panning.
        map.current?.resize();
      });
    };
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(container);
    window.addEventListener("resize", resize);
    resize();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    const source = map.current.getSource("map-entities") as
      GeoJSONSource | undefined;
    source?.setData(entityCollection(entities, placeReferences));
  }, [entities, placeReferences, ready]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const source = map.current.getSource("map-places") as
      GeoJSONSource | undefined;
    source?.setData(placeCollection(places));
  }, [places, ready]);

  useEffect(() => {
    ownedMarkerInstances.current.forEach((marker) => marker.remove());
    ownedMarkerInstances.current = [];
    if (!ready || !map.current) return undefined;
    const mapInstance = map.current;
    const offsets = markerOffsets(ownedMarkers);
    const popupDisposers: Array<() => void> = [];
    const mapGestureDisposers: Array<() => void> = [];
    const instances = ownedMarkers.map((ownedMarker) => {
      const markerOffset = offsets.get(ownedMarker.key) || [0, 0];
      const element = document.createElement("button");
      element.type = "button";
      element.className = `map-owned-marker map-owned-marker-${ownedMarker.entityType.toLowerCase()}`;
      element.setAttribute("aria-label", `Open ${ownedMarker.label}`);
      element.title = `${ownedMarker.label} · ${ownedMarker.placeName}`;
      if (ownedMarker.thumbnailUrl) {
        const image = document.createElement("img");
        image.src = ownedMarker.thumbnailUrl;
        image.alt = "";
        image.addEventListener("error", () => {
          image.remove();
          addMarkerFallback(element, ownedMarker);
        });
        element.append(image);
      } else {
        addMarkerFallback(element, ownedMarker);
      }
      // A DOM marker sits on top of MapLibre's canvas. Stop the full pointer
      // gesture, not just click, so tapping an object does not also start a
      // canvas pan/focus operation underneath it.
      const stopMapGesture = (event: Event) => event.stopPropagation();
      const mapGestureEvents = [
        "pointerdown",
        "pointerup",
        "mousedown",
        "mouseup",
        "touchstart",
        "touchend",
        "dblclick",
      ];
      mapGestureEvents.forEach((eventName) =>
        element.addEventListener(eventName, stopMapGesture),
      );
      mapGestureDisposers.push(() =>
        mapGestureEvents.forEach((eventName) =>
          element.removeEventListener(eventName, stopMapGesture),
        ),
      );
      element.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        ownedMarkerSelectRef.current?.(ownedMarker);
      });
      popupDisposers.push(
        addMarkerLinksPopup(
          mapInstance,
          element,
          {
            ...ownedMarker,
            placeReference: placeReferences.get(ownedMarker.placeId),
          },
          markerOffset,
        ),
      );
      return new maplibregl.Marker({
        element,
        anchor: "center",
        offset: markerOffset,
      })
        .setLngLat([ownedMarker.longitude, ownedMarker.latitude])
        .addTo(mapInstance);
    });
    ownedMarkerInstances.current = instances;
    return () => {
      mapGestureDisposers.forEach((dispose) => dispose());
      popupDisposers.forEach((dispose) => dispose());
      instances.forEach((marker) => marker.remove());
      if (ownedMarkerInstances.current === instances)
        ownedMarkerInstances.current = [];
    };
  }, [ownedMarkers, placeReferences, ready]);

  useEffect(() => {
    if (!ready || !map.current) return undefined;
    const mapInstance = map.current;
    const offsets = markerOffsets(thumbnailMarkers);
    const popupDisposers: Array<() => void> = [];
    const mapGestureDisposers: Array<() => void> = [];
    const instances = thumbnailMarkers.map((thumbnailMarker) => {
      const markerOffset = offsets.get(thumbnailMarker.key) || [0, 0];
      const markerElement = mapMarkerElement(thumbnailMarker, "thumbnail");
      const stopMapGesture = (event: Event) => event.stopPropagation();
      const mapGestureEvents = [
        "pointerdown",
        "pointerup",
        "mousedown",
        "mouseup",
        "touchstart",
        "touchend",
        "dblclick",
      ];
      mapGestureEvents.forEach((eventName) =>
        markerElement.addEventListener(eventName, stopMapGesture),
      );
      mapGestureDisposers.push(() =>
        mapGestureEvents.forEach((eventName) =>
          markerElement.removeEventListener(eventName, stopMapGesture),
        ),
      );
      markerElement.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        thumbnailMarkerSelectRef.current?.(thumbnailMarker);
      });
      popupDisposers.push(
        addMarkerLinksPopup(
          mapInstance,
          markerElement,
          {
            ...thumbnailMarker,
            placeReference: placeReferences.get(thumbnailMarker.placeId),
          },
          markerOffset,
        ),
      );
      return new maplibregl.Marker({
        element: markerElement,
        anchor: "center",
        offset: markerOffset,
      })
        .setLngLat([thumbnailMarker.longitude, thumbnailMarker.latitude])
        .addTo(mapInstance);
    });
    return () => {
      mapGestureDisposers.forEach((dispose) => dispose());
      popupDisposers.forEach((dispose) => dispose());
      instances.forEach((marker) => marker.remove());
    };
  }, [placeReferences, ready, thumbnailMarkers]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const mapInstance = map.current;
    const data = ownedConnectionCollection(ownedConnections, ownedMarkers);
    const sync = () => {
      const source = mapInstance.getSource("map-owned-connections") as
        | GeoJSONSource
        | undefined;
      source?.setData(data);
    };
    // A map can report its initial load before every style source has become
    // addressable. Update immediately and once more after the next idle turn
    // so relationship lines cannot be lost to that timing race.
    sync();
    mapInstance.once("idle", sync);
    return () => {
      mapInstance.off("idle", sync);
    };
  }, [ownedConnections, ownedMarkers, ready]);

  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setFilter("map-entity-selected", [
      "==",
      ["get", "key"],
      selectedEntityKey || "__none__",
    ]);
  }, [ready, selectedEntityKey]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const key = selectedPlaceId ? `PLACE:${selectedPlaceId}` : "__none__";
    map.current.setFilter("map-place-selected", ["==", ["get", "key"], key]);
  }, [ready, selectedPlaceId]);

  useEffect(() => {
    selectedPlaceMarker.current?.remove();
    selectedPlaceMarker.current = null;
    if (!ready || !map.current || !selectedPlaceId) return undefined;
    const place = places.find((item) => item.id === selectedPlaceId);
    if (!place) return undefined;
    const element = document.createElement("a");
    element.className = "map-selected-place-label";
    element.textContent = place.matchedName || place.canonicalName;
    element.href = placePath(place);
    element.setAttribute("aria-label", `Open ${element.textContent}`);
    const marker = new maplibregl.Marker({ element, anchor: "bottom" })
      .setLngLat([place.longitude, place.latitude])
      .addTo(map.current);
    element.addEventListener("click", (event) => event.stopPropagation());
    selectedPlaceMarker.current = marker;
    return () => {
      marker.remove();
    };
  }, [places, ready, selectedPlaceId]);

  useEffect(() => {
    coordinateMarker.current?.remove();
    coordinateMarker.current = null;
    if (!ready || !map.current || !pickedCoordinate) return undefined;
    const element = document.createElement("span");
    element.className = "map-coordinate-pin";
    element.setAttribute("aria-label", "Proposed place coordinates");
    const marker = new maplibregl.Marker({ element, anchor: "bottom" })
      .setLngLat([pickedCoordinate.longitude, pickedCoordinate.latitude])
      .addTo(map.current);
    coordinateMarker.current = marker;
    return () => {
      marker.remove();
    };
  }, [pickedCoordinate, ready]);

  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setLayoutProperty(
      "borders",
      "visibility",
      showModernBorders ? "visible" : "none",
    );
  }, [ready, showModernBorders]);

  useEffect(() => {
    if (!ready || !map.current || !focus) return;
    map.current.flyTo({
      center: [focus.longitude, focus.latitude],
      zoom: Math.max(map.current.getZoom(), 6),
      duration: 750,
      essential: true,
    });
  }, [focus, ready]);

  useEffect(() => {
    if (!ready || !map.current || focus || !initialFitPoints.length) return;
    const signature = initialFitPoints
      .map(
        (point) =>
          `${point.key}:${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`,
      )
      .sort()
      .join("|");
    if (fittedPrivateMarkerSignature.current === signature) return;
    // A map attachment is often mounted while the post containing it is being
    // inserted. Its saved-centre fly animation may still be running when the
    // resolved marker graph arrives. Stop that animation and measure the
    // freshly laid-out canvas before calculating bounds; otherwise the old
    // focal point can win and leave valid markers off-screen until a reload.
    const timer = window.setTimeout(() => {
      if (!map.current) return;
      fittedPrivateMarkerSignature.current = signature;
      map.current.stop();
      map.current.resize();
      if (initialFitPoints.length === 1) {
        const point = initialFitPoints[0];
        if (!point) return;
        map.current.flyTo({
          center: [point.longitude, point.latitude],
          zoom: 6,
          duration: 0,
          essential: true,
        });
        return;
      }
      const bounds = new maplibregl.LngLatBounds();
      initialFitPoints.forEach((point) =>
        bounds.extend([point.longitude, point.latitude]),
      );
      map.current.fitBounds(bounds, {
        padding: 64,
        maxZoom: 7,
        duration: 0,
        essential: true,
      });
    }, initialFitDelayMs);
    return () => window.clearTimeout(timer);
  }, [focus, initialFitDelayMs, initialFitPoints, ready]);

  return (
    <div className="map-canvas-shell" aria-label="Interactive world map">
      <div ref={element} className="map-canvas" />
      <div className="map-legend" aria-label="Map legend">
        <span>
          <i className="map-legend-dot map-legend-profile" />
          Profiles
        </span>
        <span>
          <i className="map-legend-dot map-legend-club" />
          Clubs
        </span>
        <span>
          <i className="map-legend-dot map-legend-event" />
          Events
        </span>
        <span>
          <i className="map-legend-dot map-legend-source" />
          Sources
        </span>
        {ownedConnections.length > 0 && (
          <span>
            <i className="map-legend-line" />
            Your connections
          </span>
        )}
      </div>
    </div>
  );
}

function mapMarkerElement(
  marker: Pick<
    MapThumbnailMarker,
    "entityType" | "label" | "placeName" | "thumbnailUrl"
  >,
  kind: "owned" | "thumbnail",
): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `map-${kind}-marker map-${kind}-marker-${marker.entityType.toLowerCase()}`;
  element.setAttribute("aria-label", `Open ${marker.label}`);
  element.title = `${marker.label} · ${marker.placeName}`;
  if (marker.thumbnailUrl) {
    const image = document.createElement("img");
    image.src = marker.thumbnailUrl;
    image.alt = "";
    image.addEventListener("error", () => {
      image.remove();
      addMarkerFallback(element, marker);
    });
    element.append(image);
  } else {
    addMarkerFallback(element, marker);
  }
  return element;
}

function addMarkerFallback(
  element: HTMLButtonElement,
  marker: Pick<MapThumbnailMarker, "entityType" | "label">,
): void {
  const fallback = document.createElement("span");
  fallback.className = "map-owned-marker-fallback";
  fallback.textContent =
    marker.entityType === "SOURCE"
      ? "◆"
      : marker.label.trim().slice(0, 1).toLocaleUpperCase() || "⌛";
  element.append(fallback);
}

/** Keep several owned records at the same place individually reachable while
 * leaving their actual coordinates untouched. */
function markerOffsets(
  markers: Array<Pick<MapThumbnailMarker, "key" | "placeId">>,
): Map<string, [number, number]> {
  const grouped = new Map<
    string,
    Array<Pick<MapThumbnailMarker, "key" | "placeId">>
  >();
  markers.forEach((marker) => {
    const samePlace = grouped.get(marker.placeId) || [];
    samePlace.push(marker);
    grouped.set(marker.placeId, samePlace);
  });
  const offsets = new Map<string, [number, number]>();
  grouped.forEach((group) => {
    if (group.length === 1) {
      offsets.set(group[0].key, [0, 0]);
      return;
    }
    group.forEach((marker, index) => {
      const angle = (Math.PI * 2 * index) / group.length - Math.PI / 2;
      offsets.set(marker.key, [
        Math.round(Math.cos(angle) * 20),
        Math.round(Math.sin(angle) * 20),
      ]);
    });
  });
  return offsets;
}

function mapStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: { type: "geojson", data: BASEMAP_URL },
    },
    layers: [
      {
        id: "ocean",
        type: "background",
        paint: { "background-color": "#b9d7e5" },
      },
      {
        id: "land",
        type: "fill",
        source: "basemap",
        filter: ["==", ["get", "tempvsBasemapKind"], "land"],
        paint: { "fill-color": "#eee7d6", "fill-outline-color": "#b4a98e" },
      },
      {
        id: "lakes",
        type: "fill",
        source: "basemap",
        filter: ["==", ["get", "tempvsBasemapKind"], "lakes"],
        paint: { "fill-color": "#b9d7e5" },
      },
      {
        id: "borders",
        type: "line",
        source: "basemap",
        filter: ["==", ["get", "tempvsBasemapKind"], "borders"],
        layout: { visibility: "none" },
        paint: {
          "line-color": "#b9af9e",
          "line-width": 0.65,
          "line-opacity": 0.7,
        },
      },
    ],
  };
}

function addMarkerLayers(
  map: maplibregl.Map,
  onEntitySelect: (key: string) => void,
  onPlaceSelect: (id: string) => MapPlace | undefined,
  initialOwnedConnections: OwnedMapConnection[] = [],
  initialOwnedMarkers: OwnedMapMarker[] = [],
): void {
  map.addSource("map-entities", {
    type: "geojson",
    data: EMPTY_COLLECTION,
    cluster: true,
    clusterMaxZoom: 8,
    clusterRadius: 48,
  });
  map.addSource("map-places", { type: "geojson", data: EMPTY_COLLECTION });
  map.addSource("map-owned-connections", {
    type: "geojson",
    // Attachment previews already have their relationship graph before their
    // MapLibre instance mounts. Seed it here so edges are in the first styled
    // frame instead of waiting for React's post-ready effect.
    data: ownedConnectionCollection(initialOwnedConnections, initialOwnedMarkers),
    lineMetrics: true,
  });
  map.addLayer({
    id: "map-owned-connection-casing",
    type: "line",
    source: "map-owned-connections",
    layout: {
      "line-cap": "round" as const,
      "line-join": "round" as const,
    },
    paint: {
      // A light casing keeps relationships distinguishable from borders and
      // the parchment basemap at low zoom levels.
      "line-color": "#fffdf7",
      "line-width": 5,
      "line-opacity": 0.9,
    },
  });
  map.addLayer({
    id: "map-owned-connections",
    type: "line",
    source: "map-owned-connections",
    layout: {
      "line-cap": "round" as const,
      "line-join": "round" as const,
    },
    paint: {
      "line-color": [
        "match",
        ["get", "kind"],
        "PROFILE_SOURCE",
        "#6d7c4a",
        "PROFILE_CLUB",
        "#8a5a44",
        "SOURCE_LOCATIONS",
        "#6d7c4a",
        "EVENT_LOCATIONS",
        "#75618c",
        "#4f6d7a",
      ],
      // Relationship edges deliberately stay dashed, matching the full Map
      // view and keeping them distinct from geographic boundaries.
      "line-width": 3,
      "line-opacity": 0.96,
      "line-dasharray": [2, 1.5],
    },
  });
  map.addLayer({
    id: "map-clusters",
    type: "circle",
    source: "map-entities",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#584732",
      "circle-radius": ["step", ["get", "point_count"], 17, 25, 21, 100, 26],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#fff",
    },
  });
  // Keep clusters as circles rather than a symbol/text layer. The deliberately
  // self-contained Natural Earth style has no glyph endpoint, and MapLibre
  // rejects `text-field` layers without one. A cluster remains clearly
  // interactive (and expands on click) without making the map depend on a
  // third-party font service.
  map.addLayer({
    id: "map-entity-points",
    type: "circle",
    source: "map-entities",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": 7,
      "circle-color": markerColour(),
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#fff",
    },
  });
  map.addLayer({
    id: "map-entity-selected",
    type: "circle",
    source: "map-entities",
    filter: ["==", ["get", "key"], "__none__"],
    paint: {
      "circle-radius": 11,
      "circle-color": "#fff",
      "circle-opacity": 0.4,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#15120f",
    },
  });
  map.addLayer({
    id: "map-place-points",
    type: "circle",
    source: "map-places",
    paint: {
      "circle-radius": 4,
      "circle-color": "#15120f",
      "circle-stroke-width": 1,
      "circle-stroke-color": "#fff",
    },
  });
  map.addLayer({
    id: "map-place-selected",
    type: "circle",
    source: "map-places",
    filter: ["==", ["get", "key"], "__none__"],
    paint: {
      "circle-radius": 8,
      "circle-color": "#fff",
      "circle-opacity": 0.45,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#15120f",
    },
  });

  map.on("click", "map-clusters", (event) => {
    const feature = event.features?.[0];
    const clusterId = feature?.properties?.cluster_id;
    const source = map.getSource("map-entities") as GeoJSONSource;
    if (typeof clusterId !== "number" || !feature) return;
    const center = (feature.geometry as GeoJSON.Point).coordinates as [
      number,
      number,
    ];
    source.getClusterExpansionZoom(clusterId).then((zoom) => {
      map.easeTo({
        center,
        zoom,
      });
    });
  });
  let entityHoverPopup: maplibregl.Popup | null = null;
  let entityHoverCloseTimer: number | undefined;
  const closeEntityHoverPopup = () => {
    if (entityHoverCloseTimer !== undefined) {
      window.clearTimeout(entityHoverCloseTimer);
      entityHoverCloseTimer = undefined;
    }
    entityHoverPopup?.remove();
    entityHoverPopup = null;
  };
  const scheduleEntityHoverClose = () => {
    if (entityHoverCloseTimer !== undefined)
      window.clearTimeout(entityHoverCloseTimer);
    entityHoverCloseTimer = window.setTimeout(closeEntityHoverPopup, 160);
  };
  const markerFromFeature = (feature: maplibregl.MapGeoJSONFeature) => {
    const properties = feature.properties;
    const entityType = properties?.kind;
    const entityId = properties?.entityId;
    const placeId = properties?.placeId;
    const placeName = properties?.placeName;
    const placeReference = properties?.placeReference;
    const label = properties?.label;
    if (
      !isEntityType(entityType) ||
      typeof entityId !== "string" ||
      typeof placeId !== "string" ||
      typeof placeName !== "string" ||
      typeof label !== "string"
    )
      return null;
    return {
      entityType,
      entityId,
      placeId,
      placeName,
      label,
      ...(typeof placeReference === "string" ? { placeReference } : {}),
    };
  };
  const coordinatesFromFeature = (feature: maplibregl.MapGeoJSONFeature) =>
    (feature.geometry as GeoJSON.Point).coordinates as [number, number];
  const openEntityPopup = (
    feature: maplibregl.MapGeoJSONFeature,
    persistent: boolean,
  ) => {
    const marker = markerFromFeature(feature);
    if (!marker) return;
    const popup = new maplibregl.Popup({
      closeButton: persistent,
      closeOnClick: persistent,
      anchor: "left",
      offset: [14, 0],
      maxWidth: "18rem",
    })
      .setLngLat(coordinatesFromFeature(feature))
      .setDOMContent(markerLinksPopover(marker))
      .addTo(map);
    if (!persistent) {
      entityHoverPopup = popup;
      popup.getElement()?.addEventListener("mouseenter", () => {
        if (entityHoverCloseTimer !== undefined) {
          window.clearTimeout(entityHoverCloseTimer);
          entityHoverCloseTimer = undefined;
        }
      });
      popup
        .getElement()
        ?.addEventListener("mouseleave", scheduleEntityHoverClose);
    }
  };
  map.on("click", "map-entity-points", (event) => {
    const feature = event.features?.[0];
    const key = feature?.properties?.key;
    if (typeof key === "string") onEntitySelect(key);
    // Hover gives desktop users a lightweight preview; a click deliberately
    // keeps the same two links open for touch users.
    if (feature) openEntityPopup(feature, true);
  });
  map.on("mouseenter", "map-entity-points", (event) => {
    const feature = event.features?.[0];
    if (!feature || !markerFromFeature(feature)) return;
    closeEntityHoverPopup();
    openEntityPopup(feature, false);
  });
  map.on("mouseleave", "map-entity-points", scheduleEntityHoverClose);
  const openPlace = (event: maplibregl.MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.placeId;
    if (typeof id !== "string") return;
    const place = onPlaceSelect(id);
    if (!place) return;
    const coordinates = (event.features?.[0]?.geometry as GeoJSON.Point)
      .coordinates as [number, number];
    new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "18rem",
    })
      .setLngLat(coordinates)
      .setDOMContent(placePopover(place))
      .addTo(map);
  };
  map.on("click", "map-place-points", openPlace);
  for (const layer of [
    "map-clusters",
    "map-entity-points",
    "map-place-points",
  ]) {
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}

function markerColour(): maplibregl.ExpressionSpecification {
  return [
    "match",
    ["get", "kind"],
    "PROFILE",
    "#4f6d7a",
    "CLUB",
    "#8a5a44",
    "EVENT",
    "#75618c",
    "SOURCE",
    "#6d7c4a",
    "#15120f",
  ];
}

type LinkedMarker = Pick<
  MapThumbnailMarker,
  "entityType" | "entityId" | "placeId" | "placeName" | "label"
> & { placeReference?: string };
type LinkableMarker = LinkedMarker &
  Pick<MapThumbnailMarker, "latitude" | "longitude">;

function addMarkerLinksPopup(
  map: maplibregl.Map,
  trigger: HTMLElement,
  marker: LinkableMarker,
  markerOffset: [number, number],
): () => void {
  let popup: maplibregl.Popup | null = null;
  let closeTimer: number | undefined;
  const close = () => {
    if (closeTimer !== undefined) {
      window.clearTimeout(closeTimer);
      closeTimer = undefined;
    }
    popup?.remove();
    popup = null;
  };
  const scheduleClose = () => {
    if (closeTimer !== undefined) window.clearTimeout(closeTimer);
    // Leave a forgiving bridge from a thumbnail to its nearby popup. A short
    // delay made its place link unreachable with a mouse at some zoom levels.
    closeTimer = window.setTimeout(close, 420);
  };
  const open = () => {
    if (closeTimer !== undefined) {
      window.clearTimeout(closeTimer);
      closeTimer = undefined;
    }
    if (popup) return;
    popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: "left",
      // DOM markers may be deliberately spread around the same map point.
      // Match that visual displacement and clear the thumbnail's right edge,
      // so the hover card belongs to the image rather than its source point.
      offset: [markerOffset[0] + 8, markerOffset[1]],
      maxWidth: "18rem",
    })
      .setLngLat([marker.longitude, marker.latitude])
      .setDOMContent(markerLinksPopover(marker))
      .addTo(map);
    popup.getElement()?.addEventListener("mouseenter", open);
    popup.getElement()?.addEventListener("mouseleave", scheduleClose);
  };
  trigger.addEventListener("mouseenter", open);
  trigger.addEventListener("mouseleave", scheduleClose);
  trigger.addEventListener("focus", open);
  trigger.addEventListener("blur", scheduleClose);
  return () => {
    trigger.removeEventListener("mouseenter", open);
    trigger.removeEventListener("mouseleave", scheduleClose);
    trigger.removeEventListener("focus", open);
    trigger.removeEventListener("blur", scheduleClose);
    close();
  };
}

function markerLinksPopover(marker: LinkedMarker): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "map-marker-popover";
  container.addEventListener("click", (event) => event.stopPropagation());
  const entityLink = document.createElement("a");
  entityLink.className = "map-marker-resource-link";
  entityLink.href = entityPath(marker.entityType, marker.entityId);
  entityLink.textContent = marker.label;
  const placeLink = document.createElement("a");
  placeLink.className = "map-marker-place-link";
  placeLink.href = placePath(marker.placeReference || marker.placeId);
  // A reference (alias or UUID) belongs in the URL, not in the visible
  // tooltip. The marker retains the exact historical/canonical name selected
  // when the location was assigned to the resource.
  placeLink.textContent = marker.placeName;
  container.append(entityLink, placeLink);
  return container;
}

function placePath(
  place: Pick<MapPlace, "id" | "publicId" | "alias"> | string,
): string {
  const reference =
    typeof place === "string" ? place : place.alias || place.publicId || place.id;
  return `/map/place/${encodeURIComponent(reference)}`;
}

function entityPath(
  entityType: MapEntityLocation["entityType"],
  entityId: string,
): string {
  const id = encodeURIComponent(entityId);
  switch (entityType) {
    case "PROFILE":
      return `/profile/${id}`;
    case "CLUB":
      return `/clubs/${id}`;
    case "EVENT":
      return `/events/${id}`;
    case "SOURCE":
      return `/library/source/${id}`;
  }
}

function isEntityType(
  value: unknown,
): value is MapEntityLocation["entityType"] {
  return (
    value === "PROFILE" ||
    value === "CLUB" ||
    value === "EVENT" ||
    value === "SOURCE"
  );
}

function entityCollection(
  entities: MapEntityLocation[],
  placeReferences: ReadonlyMap<string, string>,
): GeoJSON.FeatureCollection<GeoJSON.Point, MarkerProperties> {
  return {
    type: "FeatureCollection",
    features: entities.map((entity) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [entity.longitude, entity.latitude],
      },
      properties: {
        key: entityKey(entity),
        kind: entity.entityType,
        label: entity.label,
        role: entity.locationRole,
        entityId: entity.entityId,
        placeId: entity.placeId,
        placeReference: placeReferences.get(entity.placeId),
        placeName: entity.placeName,
      },
    })),
  };
}

function placeCollection(
  places: MapPlace[],
): GeoJSON.FeatureCollection<GeoJSON.Point, MarkerProperties> {
  return {
    type: "FeatureCollection",
    features: places.map((place) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [place.longitude, place.latitude],
      },
      properties: {
        key: `PLACE:${place.id}`,
        kind: "PLACE",
        placeId: place.id,
        label: place.matchedName || place.canonicalName,
      },
    })),
  };
}

export function ownedConnectionCollection(
  connections: OwnedMapConnection[],
  markers: OwnedMapMarker[],
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const markerByKey = new Map(markers.map((marker) => [marker.key, marker]));
  return {
    type: "FeatureCollection",
    features: connections.flatMap((connection) => {
      const from = markerByKey.get(connection.fromKey);
      const to = markerByKey.get(connection.toKey);
      if (!from || !to) return [];
      return [
        {
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: visibleConnectionCoordinates(from, to),
          },
          properties: { key: connection.key, kind: connection.kind },
        },
      ];
    }),
  };
}

/**
 * A profile and one of its sources can legitimately use the exact same
 * approved place. MapLibre does not paint a zero-length LineString, which made
 * those real relationships appear to be missing. Render a compact loop from
 * the shared pin in that case; geographically distinct relationships remain
 * ordinary direct lines.
 */
function visibleConnectionCoordinates(
  from: Pick<OwnedMapMarker, "latitude" | "longitude">,
  to: Pick<OwnedMapMarker, "latitude" | "longitude">,
): GeoJSON.Position[] {
  const samePlace =
    Math.abs(from.latitude - to.latitude) < 0.00001 &&
    Math.abs(from.longitude - to.longitude) < 0.00001;
  if (!samePlace) {
    return [
      [from.longitude, from.latitude],
      [to.longitude, to.latitude],
    ];
  }

  // About 20 km tall at the equator: large enough to survive a compact mobile
  // preview, but still clearly anchored to the shared location. Longitude is
  // scaled for latitude so the loop stays roughly circular.
  const radius = 0.18;
  const longitudeRadius =
    radius /
    Math.max(0.25, Math.cos((from.latitude * Math.PI) / 180));
  const centerLatitude = Math.max(
    -89.75,
    Math.min(89.75, from.latitude + radius),
  );
  return Array.from({ length: 17 }, (_, index) => {
    const angle = -Math.PI / 2 + (index / 16) * Math.PI * 2;
    return [
      from.longitude + longitudeRadius * Math.cos(angle),
      centerLatitude + radius * Math.sin(angle),
    ];
  });
}

/** Build popup content with DOM nodes rather than HTML so imported place names
 * are always displayed as text, never interpreted as markup. */
function placePopover(place: MapPlace): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "map-place-popover";
  const heading = document.createElement("strong");
  heading.textContent = place.matchedName || place.canonicalName;
  container.append(heading);
  const names = place.names?.length
    ? place.names
    : [{ value: place.canonicalName, preferred: true }];
  const distinctNames = names.filter(
    (name, index) =>
      names.findIndex((candidate) => candidate.value === name.value) === index,
  );
  if (distinctNames.length) {
    const list = document.createElement("ul");
    list.className = "map-place-name-list";
    for (const name of distinctNames) {
      const item = document.createElement("li");
      item.textContent = `${name.value}${name.preferred ? " (canonical)" : ""}${formatPlaceNameRange(name.validFrom, name.validTo)}`;
      list.append(item);
    }
    container.append(list);
  }
  return container;
}

export function entityKey(entity: MapEntityLocation): string {
  return `${entity.entityType}:${entity.entityId}:${entity.locationRole}`;
}
