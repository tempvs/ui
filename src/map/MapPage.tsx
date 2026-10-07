import React, { useEffect, useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import { Link, useSearchParams } from "react-router-dom";
import PageLayout from "../component/PageLayout";
import { nearbyMapPlaces, searchMapPlaces, type MapPlace } from "./mapApi";

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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const search = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError("");
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
      setItems(
        hasCoordinates
          ? await nearbyMapPlaces(lat, lng, Number(radius))
          : await searchMapPlaces(trimmed),
      );
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
              <Link
                className="ms-2"
                to={`/map?q=${encodeURIComponent(place.canonicalName)}`}
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageLayout>
  );
}
