import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import { Link, useSearchParams } from "react-router-dom";
import PageLayout from "../component/PageLayout";
import {
  nearbyMapEntities,
  nearbyMapPlaces,
  searchMapPlaces,
  type MapEntityLocation,
  type MapPlace,
} from "./mapApi";
import MapCanvas, { entityKey } from "./MapCanvas";

const entityTypes: MapEntityLocation["entityType"][] = [
  "PROFILE",
  "CLUB",
  "EVENT",
  "SOURCE",
];

/**
 * Public, keyboard-accessible discovery fallback. It persists its query in
 * the URL so a searched place can be shared before the tile-backed map lands.
 */
export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [latitude, setLatitude] = useState(params.get("lat") || "");
  const [longitude, setLongitude] = useState(params.get("lng") || "");
  const [radius, setRadius] = useState(params.get("radiusKm") || "25");
  const [items, setItems] = useState<MapPlace[]>([]);
  const [entities, setEntities] = useState<MapEntityLocation[]>([]);
  const [types, setTypes] =
    useState<MapEntityLocation["entityType"][]>(entityTypes);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [selectedEntityKey, setSelectedEntityKey] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const search = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError("");
    setMapError("");
    const trimmed = query.trim();
    const lat = Number(latitude);
    const lng = Number(longitude);
    const hasCoordinates = latitude !== "" || longitude !== "";
    if (!hasCoordinates && trimmed.length < 2) {
      setError("Enter at least two characters, or both coordinates.");
      return;
    }
    if (hasCoordinates && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
      setError("Enter valid latitude and longitude values.");
      return;
    }
    const next = new URLSearchParams();
    if (trimmed) next.set("q", trimmed);
    if (hasCoordinates) {
      next.set("lat", String(lat));
      next.set("lng", String(lng));
      next.set("radiusKm", radius);
    }
    setParams(next, { replace: true });
    setLoading(true);
    try {
      if (hasCoordinates) {
        const [places, nearbyEntities] = await Promise.all([
          nearbyMapPlaces(lat, lng, Number(radius)),
          nearbyMapEntities(lat, lng, Number(radius), types),
        ]);
        setItems(places);
        setEntities(nearbyEntities);
      } else {
        setItems(await searchMapPlaces(trimmed));
        setEntities([]);
      }
    } catch (caught) {
      setError((caught as Error).message || "Unable to load places.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.get("q") || (params.get("lat") && params.get("lng")))
      void search();
    // Query parameters are intentionally applied only on navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focus = useMemo(() => {
    const selected = entities.find(
      (entity) => entityKey(entity) === selectedEntityKey,
    );
    if (selected)
      return { latitude: selected.latitude, longitude: selected.longitude };
    if (latitude !== "" && longitude !== "") {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng))
        return { latitude: lat, longitude: lng };
    }
    const first = items[0];
    return first
      ? { latitude: first.latitude, longitude: first.longitude }
      : null;
  }, [entities, items, latitude, longitude, selectedEntityKey]);

  return (
    <PageLayout className="map-page" header={{ title: "Map" }}>
      <section className="club-panel" aria-label="Map place search">
        <h1>Place discovery</h1>
        <p className="text-muted">
          Search approved places by name, or browse a bounded radius around
          coordinates.
        </p>
        <Form
          onSubmit={search}
          className="d-flex gap-2 flex-wrap align-items-end"
        >
          <Form.Group>
            <Form.Label>Place</Form.Label>
            <Form.Control
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rome, Constantinople…"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Show</Form.Label>
            <div className="d-flex gap-2 flex-wrap">
              {entityTypes.map((type) => (
                <Form.Check
                  inline
                  key={type}
                  id={`map-type-${type}`}
                  label={type[0] + type.slice(1).toLowerCase()}
                  checked={types.includes(type)}
                  onChange={() =>
                    setTypes((current) =>
                      current.includes(type)
                        ? current.filter((value) => value !== type)
                        : [...current, type],
                    )
                  }
                />
              ))}
            </div>
          </Form.Group>
          <Form.Group>
            <Form.Label>Latitude</Form.Label>
            <Form.Control
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              inputMode="decimal"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Longitude</Form.Label>
            <Form.Control
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              inputMode="decimal"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Radius km</Form.Label>
            <Form.Control
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
              type="number"
              min={1}
              max={200}
            />
          </Form.Group>
          <Button type="submit" variant="dark" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </Button>
        </Form>
        {error && (
          <Alert className="mt-3 mb-0" variant="danger">
            {error}
          </Alert>
        )}
      </section>
      <section className="club-panel mt-3" aria-label="Interactive map">
        <MapCanvas
          places={items}
          entities={entities}
          focus={focus}
          selectedEntityKey={selectedEntityKey}
          onEntitySelect={setSelectedEntityKey}
          onMapError={setMapError}
        />
        {mapError && (
          <p className="text-muted small mt-2 mb-0">
            The interactive map is unavailable; the accessible result lists
            below remain available.
          </p>
        )}
      </section>
      <section className="club-panel mt-3" aria-label="Matching places">
        <h2 className="h5">Places</h2>
        {!loading && !error && items.length === 0 && (
          <p className="text-muted mb-0">Search for a place to begin.</p>
        )}
        <ul className="list-unstyled mb-0">
          {items.map((place) => (
            <li key={place.id} className="border-top py-2">
              <strong>{place.canonicalName}</strong>
              <span className="text-muted ms-2">
                {place.featureType} · {place.latitude.toFixed(4)},{" "}
                {place.longitude.toFixed(4)}
              </span>
              <Link className="ms-2" to={nearPlacePath(place, radius)}>
                Show nearby
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {(latitude || longitude) && (
        <section className="club-panel mt-3" aria-label="Nearby content">
          <h2 className="h5">Nearby content</h2>
          {!loading && !error && entities.length === 0 && (
            <p className="text-muted mb-0">
              No matching public content in this radius.
            </p>
          )}
          <ul className="list-unstyled mb-0">
            {entities.map((entity) => (
              <li
                key={`${entity.entityType}:${entity.entityId}:${entity.locationRole}`}
                className={`border-top py-2 ${selectedEntityKey === entityKey(entity) ? "map-result-selected" : ""}`}
                onClick={() => setSelectedEntityKey(entityKey(entity))}
              >
                <Link to={entityPath(entity)}>{entity.label}</Link>
                <span className="text-muted ms-2">
                  {locationRoleLabel(entity)} · {entity.placeName}
                  {Number.isFinite(Number(latitude)) &&
                    Number.isFinite(Number(longitude)) &&
                    ` · ${formatDistance(
                      distanceKilometres(
                        Number(latitude),
                        Number(longitude),
                        entity.latitude,
                        entity.longitude,
                      ),
                    )}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageLayout>
  );
}

function entityPath(entity: MapEntityLocation): string {
  switch (entity.entityType) {
    case "PROFILE":
      return `/profile/${entity.entityId}`;
    case "CLUB":
      return `/clubs/${entity.entityId}`;
    case "EVENT":
      return `/events/${entity.entityId}`;
    case "SOURCE":
      return `/library/source/${entity.entityId}`;
  }
}

function locationRoleLabel(entity: MapEntityLocation): string {
  return {
    CURRENT_RESIDENCE: "Residence",
    CLUB_ASSOCIATION: "Associated place",
    VENUE: "Venue",
    DISCOVERED_AT: "Discovered at",
    HELD_AT: "Held at",
  }[entity.locationRole];
}

function nearPlacePath(place: MapPlace, radius: string): string {
  const parameters = new URLSearchParams({
    q: place.canonicalName,
    lat: String(place.latitude),
    lng: String(place.longitude),
    radiusKm: radius || "25",
  });
  return `/map?${parameters.toString()}`;
}

function distanceKilometres(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(toLatitude - fromLatitude);
  const longitudeDelta = radians(toLongitude - fromLongitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(fromLatitude)) *
      Math.cos(radians(toLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distance: number): string {
  return distance < 1
    ? `${Math.round(distance * 1000)} m away`
    : `${distance.toFixed(distance < 10 ? 1 : 0)} km away`;
}
