import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getViewer, type Viewer } from "../auth/viewerApi";
import PageLayout from "../component/PageLayout";
import HistoricalRangeFilter, {
  isValidHistoricalRange,
  type HistoricalYearInput,
} from "../component/HistoricalRangeFilter";
import {
  getMapPlace,
  nearbyMapEntities,
  nearbyMapPlaces,
  searchMapPlaces,
  type MapEntityLocation,
  type MapPlace,
  type SourceLocationRole,
} from "./mapApi";
import MapCanvas, { entityKey } from "./MapCanvas";
import { loadOwnedMapContent, type OwnedMapMarker } from "./ownedMapContent";
import PlaceProposalModal from "./PlaceProposalModal";
import { matchingPlaceName } from "./placeNames";

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
  const navigate = useNavigate();
  const [query, setQuery] = useState(params.get("q") || "");
  const [contentQuery, setContentQuery] = useState(params.get("content") || "");
  const [latitude, setLatitude] = useState(params.get("lat") || "");
  const [longitude, setLongitude] = useState(params.get("lng") || "");
  const [radius, setRadius] = useState(params.get("radiusKm") || "25");
  const [showModernBorders, setShowModernBorders] = useState(
    params.get("borders") === "modern",
  );
  const [items, setItems] = useState<MapPlace[]>([]);
  const [suggestions, setSuggestions] = useState<MapPlace[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsFailed, setSuggestionsFailed] = useState(false);
  const [entities, setEntities] = useState<MapEntityLocation[]>([]);
  const [types, setTypes] =
    useState<MapEntityLocation["entityType"][]>(entityTypes);
  const [sourceRoles, setSourceRoles] = useState<SourceLocationRole[]>(() =>
    parseSourceRoles(params.get("sourceRoles")),
  );
  const [nameFrom, setNameFrom] = useState<HistoricalYearInput>(() =>
    parseHistoricalYear(params.get("nameFrom")),
  );
  const [nameTo, setNameTo] = useState<HistoricalYearInput>(() =>
    parseHistoricalYear(params.get("nameTo")),
  );
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [selectedEntityKey, setSelectedEntityKey] = useState<string | null>(
    null,
  );
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [ownedMarkers, setOwnedMarkers] = useState<OwnedMapMarker[]>([]);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const suggestionRequest = useRef(0);

  useEffect(() => {
    void getViewer().then(setViewer);
  }, []);

  // Opening the Map from the horizontal navigation should be useful even
  // before a search: show the signed-in person's profiles, their club
  // memberships, and sources used by their club profiles. This is a private
  // overlay assembled in the browser, not a new public discovery endpoint.
  useEffect(() => {
    let active = true;
    if (!viewer) {
      setOwnedMarkers([]);
      return () => {
        active = false;
      };
    }
    void loadOwnedMapContent(viewer.userId)
      .then((markers) => {
        if (active) setOwnedMarkers(markers);
      })
      .catch(() => {
        // Ownership context is a convenience. Keep public map search usable
        // when an optional profile, club, or stash read is unavailable.
        if (active) setOwnedMarkers([]);
      });
    return () => {
      active = false;
    };
  }, [viewer]);

  const canReviewPlaces = viewer?.roles.some(
    (role) => role === "TEMPVS_ADMIN" || role === "MAP_EDITOR",
  );

  // Match the profile picker: query after a short pause and discard every
  // superseded response. This keeps the main map stable while someone types.
  useEffect(() => {
    const normalized = query.trim();
    if (selectedPlaceId || normalized.length < 2) {
      setSuggestions(null);
      setSuggestionsLoading(false);
      setSuggestionsFailed(false);
      return undefined;
    }
    const requestId = ++suggestionRequest.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSuggestionsLoading(true);
      setSuggestionsFailed(false);
      searchPlacesWithNameRange(normalized, controller.signal, nameFrom, nameTo)
        .then((places) => {
          if (requestId !== suggestionRequest.current) return;
          setSuggestions(
            places.map((place) => ({
              ...place,
              matchedName: matchingPlaceName(place, normalized),
            })),
          );
        })
        .catch((caught: unknown) => {
          if (
            requestId === suggestionRequest.current &&
            (caught as Error).name !== "AbortError"
          ) {
            setSuggestions(null);
            setSuggestionsFailed(true);
          }
        })
        .finally(() => {
          if (requestId === suggestionRequest.current)
            setSuggestionsLoading(false);
        });
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, selectedPlaceId, nameFrom, nameTo]);

  const selectPlace = async (place: MapPlace) => {
    const selected = {
      ...place,
      matchedName: place.matchedName || matchingPlaceName(place, query),
    };
    const nextQuery = selected.matchedName || selected.canonicalName;
    setError("");
    setMapError("");
    setQuery(nextQuery);
    setLatitude(String(selected.latitude));
    setLongitude(String(selected.longitude));
    setSelectedPlaceId(selected.id);
    setSelectedEntityKey(null);
    setSuggestions(null);
    const next = new URLSearchParams({
      placeId: selected.id,
      q: nextQuery,
      lat: String(selected.latitude),
      lng: String(selected.longitude),
      radiusKm: radius,
    });
    if (contentQuery.trim()) next.set("content", contentQuery.trim());
    if (sourceRoles.length) next.set("sourceRoles", sourceRoles.join(","));
    appendNameRange(next, nameFrom, nameTo);
    if (showModernBorders) next.set("borders", "modern");
    setParams(next, { replace: true });
    setLoading(true);
    try {
      const [places, nearbyEntities] = await Promise.all([
        nearbyMapPlaces(selected.latitude, selected.longitude, Number(radius)),
        types.length
          ? nearbyMapEntities(
              selected.latitude,
              selected.longitude,
              Number(radius),
              types,
              contentQuery,
              undefined,
              sourceRoles,
            )
          : Promise.resolve([]),
      ]);
      setItems([
        selected,
        ...places.filter((candidate) => candidate.id !== selected.id),
      ]);
      setEntities(nearbyEntities);
    } catch (caught) {
      setError((caught as Error).message || "Unable to load places.");
    } finally {
      setLoading(false);
    }
  };

  const search = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError("");
    setMapError("");
    const trimmed = query.trim();
    const linkedPlaceId = event ? null : params.get("placeId");
    let linkedPlace: MapPlace | null = null;
    if (linkedPlaceId) {
      try {
        linkedPlace = await getMapPlace(linkedPlaceId);
      } catch (caught) {
        setError((caught as Error).message || "Unable to load this place.");
        return;
      }
      if (!linkedPlace) {
        setError("This place is no longer available.");
        return;
      }
    }
    const activeLatitude = linkedPlace
      ? String(linkedPlace.latitude)
      : latitude;
    const activeLongitude = linkedPlace
      ? String(linkedPlace.longitude)
      : longitude;
    const lat = Number(activeLatitude);
    const lng = Number(activeLongitude);
    const hasCoordinates = activeLatitude !== "" || activeLongitude !== "";
    if (!isValidHistoricalRange(nameFrom, nameTo)) {
      setError("Name years must be chronological positive years.");
      return;
    }
    if (!hasCoordinates && trimmed.length < 2) {
      setError("Enter at least two characters, or both coordinates.");
      return;
    }
    if (hasCoordinates && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
      setError("Enter valid latitude and longitude values.");
      return;
    }
    const next = new URLSearchParams();
    if (linkedPlace) next.set("placeId", linkedPlace.id);
    if (linkedPlace?.canonicalName || trimmed)
      next.set("q", linkedPlace?.canonicalName || trimmed);
    if (contentQuery.trim()) next.set("content", contentQuery.trim());
    if (sourceRoles.length) next.set("sourceRoles", sourceRoles.join(","));
    appendNameRange(next, nameFrom, nameTo);
    if (showModernBorders) next.set("borders", "modern");
    if (hasCoordinates) {
      next.set("lat", String(lat));
      next.set("lng", String(lng));
      next.set("radiusKm", radius);
    }
    setParams(next, { replace: true });
    if (linkedPlace) {
      linkedPlace = {
        ...linkedPlace,
        matchedName: matchingPlaceName(linkedPlace, trimmed),
      };
      setQuery(linkedPlace.matchedName || linkedPlace.canonicalName);
      setLatitude(String(linkedPlace.latitude));
      setLongitude(String(linkedPlace.longitude));
      setSelectedPlaceId(linkedPlace.id);
    } else {
      setSelectedPlaceId(null);
    }
    setLoading(true);
    try {
      if (hasCoordinates) {
        const [places, nearbyEntities] = await Promise.all([
          nearbyMapPlaces(lat, lng, Number(radius)),
          types.length
            ? nearbyMapEntities(
                lat,
                lng,
                Number(radius),
                types,
                contentQuery,
                undefined,
                sourceRoles,
              )
            : Promise.resolve([]),
        ]);
        setItems(
          linkedPlace
            ? [
                linkedPlace,
                ...places.filter((place) => place.id !== linkedPlace?.id),
              ]
            : places,
        );
        setEntities(nearbyEntities);
      } else {
        setItems(
          (
            await searchPlacesWithNameRange(
              trimmed,
              undefined,
              nameFrom,
              nameTo,
            )
          ).map((place) => ({
            ...place,
            matchedName: matchingPlaceName(place, trimmed),
          })),
        );
        setEntities([]);
      }
    } catch (caught) {
      setError((caught as Error).message || "Unable to load places.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      params.get("placeId") ||
      params.get("q") ||
      (params.get("lat") && params.get("lng"))
    )
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
    if (first) return { latitude: first.latitude, longitude: first.longitude };
    const owned = ownedMarkers[0];
    return owned
      ? { latitude: owned.latitude, longitude: owned.longitude }
      : null;
  }, [entities, items, latitude, longitude, ownedMarkers, selectedEntityKey]);

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
          <Form.Group
            className="map-place-search-field"
            controlId="map-place-search"
          >
            <Form.Label>Place</Form.Label>
            <Form.Control
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedPlaceId(null);
                setLatitude("");
                setLongitude("");
              }}
              autoComplete="off"
              placeholder="Rome, Constantinople…"
            />
            {suggestionsLoading && (
              <p className="map-place-suggestions-status" role="status">
                Searching…
              </p>
            )}
            {suggestionsFailed && (
              <p
                className="map-place-suggestions-status text-danger"
                role="alert"
              >
                Unable to search places right now.
              </p>
            )}
            {!suggestionsLoading && suggestions && (
              <div
                className="map-place-suggestions"
                role="listbox"
                aria-label="Matching places"
              >
                {suggestions.length === 0 ? (
                  <p className="small text-muted mb-0 px-2 py-1">
                    No approved places match this search.
                  </p>
                ) : (
                  suggestions.map((place) => (
                    <button
                      type="button"
                      key={place.id}
                      className="map-place-suggestion"
                      role="option"
                      aria-selected={selectedPlaceId === place.id}
                      onClick={() => void selectPlace(place)}
                    >
                      <strong>
                        {place.matchedName || place.canonicalName}
                      </strong>
                      {place.matchedName &&
                        place.matchedName !== place.canonicalName && (
                          <span className="text-muted">
                            {" "}
                            ({place.canonicalName})
                          </span>
                        )}
                      <span className="text-muted ms-2 small">
                        {place.featureType}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </Form.Group>
          <HistoricalRangeFilter
            enabled
            from={nameFrom}
            to={nameTo}
            onEnabledChange={() => undefined}
            onFromChange={setNameFrom}
            onToChange={setNameTo}
            label="Name years"
            showToggle={false}
            alwaysShowFields
            compact
            className="mb-0"
          />
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
          {types.includes("SOURCE") && (
            <Form.Group>
              <Form.Label>Source place</Form.Label>
              <div className="d-flex gap-2 flex-wrap">
                {(
                  [
                    ["DISCOVERED_AT", "Discovered at"],
                    ["HELD_AT", "Held at"],
                  ] as const
                ).map(([role, label]) => (
                  <Form.Check
                    inline
                    key={role}
                    id={`map-source-role-${role}`}
                    label={label}
                    checked={sourceRoles.includes(role)}
                    onChange={() =>
                      setSourceRoles((current) =>
                        current.includes(role)
                          ? current.filter((value) => value !== role)
                          : [...current, role],
                      )
                    }
                  />
                ))}
              </div>
            </Form.Group>
          )}
          <Form.Check
            id="map-modern-borders"
            label="Modern borders"
            checked={showModernBorders}
            onChange={(event) => setShowModernBorders(event.target.checked)}
          />
          <Form.Group>
            <Form.Label>Content</Form.Label>
            <Form.Control
              value={contentQuery}
              onChange={(event) => setContentQuery(event.target.value)}
              placeholder="Name or place"
              aria-label="Filter nearby content"
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
          {viewer && (
            <Button
              type="button"
              variant="outline-dark"
              onClick={() => setShowProposalModal(true)}
            >
              Propose a place
            </Button>
          )}
          {canReviewPlaces && (
            <Button
              type="button"
              variant="outline-dark"
              onClick={() => navigate("/map/admin")}
            >
              Review proposals
            </Button>
          )}
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
          ownedMarkers={ownedMarkers}
          focus={focus}
          showModernBorders={showModernBorders}
          selectedEntityKey={selectedEntityKey}
          selectedPlaceId={selectedPlaceId}
          onEntitySelect={setSelectedEntityKey}
          onPlaceSelect={(place) => {
            setSelectedPlaceId(place.id);
            setQuery(place.matchedName || place.canonicalName);
          }}
          onOwnedMarkerSelect={(marker) => navigate(marker.path)}
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
              <button
                type="button"
                className="map-place-result-name"
                onClick={() => void selectPlace(place)}
              >
                {place.matchedName || place.canonicalName}
              </button>
              {place.matchedName &&
                place.matchedName !== place.canonicalName && (
                  <span className="text-muted ms-1">
                    ({place.canonicalName})
                  </span>
                )}
              <span className="text-muted ms-2">
                {place.featureType} · {place.latitude.toFixed(4)},{" "}
                {place.longitude.toFixed(4)}
              </span>
              <Link
                className="ms-2"
                to={`/map/place/${encodeURIComponent(place.id)}`}
              >
                Place details
              </Link>
              <Link
                className="ms-2"
                to={nearPlacePath(
                  place,
                  radius,
                  contentQuery,
                  showModernBorders,
                  sourceRoles,
                )}
              >
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
      <PlaceProposalModal
        show={showProposalModal}
        initialLatitude={latitude}
        initialLongitude={longitude}
        onHide={() => setShowProposalModal(false)}
      />
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

function nearPlacePath(
  place: MapPlace,
  radius: string,
  contentQuery: string,
  showModernBorders: boolean,
  sourceRoles: SourceLocationRole[],
): string {
  const parameters = new URLSearchParams({
    placeId: place.id,
    q: place.canonicalName,
    lat: String(place.latitude),
    lng: String(place.longitude),
    radiusKm: radius || "25",
  });
  if (contentQuery.trim()) parameters.set("content", contentQuery.trim());
  if (sourceRoles.length) parameters.set("sourceRoles", sourceRoles.join(","));
  if (showModernBorders) parameters.set("borders", "modern");
  return `/map?${parameters.toString()}`;
}

function parseSourceRoles(value: string | null): SourceLocationRole[] {
  return (value ?? "")
    .split(",")
    .filter(
      (role): role is SourceLocationRole =>
        role === "DISCOVERED_AT" || role === "HELD_AT",
    )
    .filter((role, index, all) => all.indexOf(role) === index);
}

function parseHistoricalYear(value: string | null): HistoricalYearInput {
  const parsed = value === null ? Number.NaN : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed === 0)
    return { year: "", era: "AD" };
  return parsed < 0
    ? { year: String(1 - parsed), era: "BC" }
    : { year: String(parsed), era: "AD" };
}

function toAstronomicalYear(value: HistoricalYearInput): number | undefined {
  if (!value.year || !/^[1-9][0-9]*$/.test(value.year)) return undefined;
  const year = Number(value.year);
  return value.era === "BC" ? 1 - year : year;
}

function appendNameRange(
  parameters: URLSearchParams,
  from: HistoricalYearInput,
  to: HistoricalYearInput,
): void {
  const start = toAstronomicalYear(from);
  const end = toAstronomicalYear(to);
  if (start !== undefined) parameters.set("nameFrom", String(start));
  if (end !== undefined) parameters.set("nameTo", String(end));
}

function searchPlacesWithNameRange(
  query: string,
  signal: AbortSignal | undefined,
  from: HistoricalYearInput,
  to: HistoricalYearInput,
): ReturnType<typeof searchMapPlaces> {
  const start = toAstronomicalYear(from);
  const end = toAstronomicalYear(to);
  return start === undefined && end === undefined
    ? searchMapPlaces(query, signal)
    : searchMapPlaces(query, signal, {
        ...(start !== undefined ? { from: start } : {}),
        ...(end !== undefined ? { to: end } : {}),
      });
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
