import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { MapEntityLocation, MapPlace } from "./mapApi";
import { formatPlaceNameRange } from "./placeNames";
import "./map.css";

type MapCanvasProps = {
  places: MapPlace[];
  entities: MapEntityLocation[];
  focus?: { latitude: number; longitude: number } | null;
  showModernBorders: boolean;
  selectedEntityKey?: string | null;
  /** The one place deliberately chosen from map search. Its matched name is
   * rendered beside the pin instead of labelling every nearby result. */
  selectedPlaceId?: string | null;
  onEntitySelect: (key: string) => void;
  onPlaceSelect?: (place: MapPlace) => void;
  onMapError: (message: string) => void;
};

type MarkerProperties = {
  key: string;
  kind: "PLACE" | MapEntityLocation["entityType"];
  label: string;
  role?: string;
};

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/**
 * A deliberately small, self-hosted Natural Earth style. The background is the
 * ocean; land, lakes and country boundaries are static public-domain GeoJSON.
 * Dynamic Map API results are the only per-request source.
 */
export default function MapCanvas({
  places,
  entities,
  focus,
  showModernBorders,
  selectedEntityKey = null,
  selectedPlaceId = null,
  onEntitySelect,
  onPlaceSelect,
  onMapError,
}: MapCanvasProps) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const selectedPlaceMarker = useRef<maplibregl.Marker | null>(null);
  const selectRef = useRef(onEntitySelect);
  const placeSelectRef = useRef(onPlaceSelect);
  const placesRef = useRef(places);
  const errorRef = useRef(onMapError);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    selectRef.current = onEntitySelect;
    placeSelectRef.current = onPlaceSelect;
    errorRef.current = onMapError;
  }, [onEntitySelect, onMapError, onPlaceSelect]);

  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  useEffect(() => {
    if (!element.current || map.current) return undefined;
    const next = new maplibregl.Map({
      container: element.current,
      style: mapStyle(),
      center: [10, 24],
      zoom: 1.35,
      minZoom: 1,
      maxZoom: 12,
      attributionControl: false,
    });
    map.current = next;
    next.addControl(new maplibregl.NavigationControl({ showCompass: true }));
    next.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: "Made with Natural Earth",
      }),
    );
    next.on("error", (event) => {
      const message = event.error?.message || "The map could not be displayed.";
      if (!/source .* is not loaded/i.test(message)) errorRef.current(message);
    });
    next.on("load", () => {
      addMarkerLayers(
        next,
        (key) => selectRef.current(key),
        (id) => {
          const place = placesRef.current.find((item) => item.id === id);
          if (place) placeSelectRef.current?.(place);
          return place;
        },
      );
      setReady(true);
    });
    return () => {
      setReady(false);
      selectedPlaceMarker.current?.remove();
      selectedPlaceMarker.current = null;
      next.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    const source = map.current.getSource("map-entities") as
      GeoJSONSource | undefined;
    source?.setData(entityCollection(entities));
  }, [entities, ready]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const source = map.current.getSource("map-places") as
      GeoJSONSource | undefined;
    source?.setData(placeCollection(places));
  }, [places, ready]);

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
    const element = document.createElement("button");
    element.type = "button";
    element.className = "map-selected-place-label";
    element.textContent = place.matchedName || place.canonicalName;
    element.setAttribute("aria-label", `Show names for ${element.textContent}`);
    const marker = new maplibregl.Marker({ element, anchor: "bottom" })
      .setLngLat([place.longitude, place.latitude])
      .addTo(map.current);
    element.addEventListener("click", () => {
      placeSelectRef.current?.(place);
      new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: "18rem",
      })
        .setLngLat([place.longitude, place.latitude])
        .setDOMContent(placePopover(place))
        .addTo(map.current as maplibregl.Map);
    });
    selectedPlaceMarker.current = marker;
    return () => {
      marker.remove();
    };
  }, [places, ready, selectedPlaceId]);

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
      essential: true,
    });
  }, [focus, ready]);

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
      </div>
    </div>
  );
}

function mapStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      land: { type: "geojson", data: "/maps/ne_110m_land.geojson" },
      lakes: { type: "geojson", data: "/maps/ne_110m_lakes.geojson" },
      borders: {
        type: "geojson",
        data: "/maps/ne_110m_admin_0_boundary_lines_land.geojson",
      },
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
        source: "land",
        paint: { "fill-color": "#eee7d6", "fill-outline-color": "#b4a98e" },
      },
      {
        id: "lakes",
        type: "fill",
        source: "lakes",
        paint: { "fill-color": "#b9d7e5" },
      },
      {
        id: "borders",
        type: "line",
        source: "borders",
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
): void {
  map.addSource("map-entities", {
    type: "geojson",
    data: EMPTY_COLLECTION,
    cluster: true,
    clusterMaxZoom: 8,
    clusterRadius: 48,
  });
  map.addSource("map-places", { type: "geojson", data: EMPTY_COLLECTION });
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
  map.addLayer({
    id: "map-cluster-count",
    type: "symbol",
    source: "map-entities",
    filter: ["has", "point_count"],
    layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 },
    paint: { "text-color": "#fff" },
  });
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
  map.on("click", "map-entity-points", (event) => {
    const key = event.features?.[0]?.properties?.key;
    if (typeof key === "string") onEntitySelect(key);
  });
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

function entityCollection(
  entities: MapEntityLocation[],
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
