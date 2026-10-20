import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getViewer, type Viewer } from "../auth/viewerApi";
import PageLayout from "../component/PageLayout";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import PlaceSearchAutocomplete from "../component/PlaceSearchAutocomplete";
import {
  isValidHistoricalRange,
  type HistoricalYearInput,
} from "../component/HistoricalRangeFilter";
import { getClubProfiles, getUserProfileByUserId } from "../profile/profileApi";
import {
  buildOwnedProfileOptions,
  resolveCurrentProfileOption,
} from "../profile/currentProfile";
import {
  getMapPlace,
  listMyMapPlaceProposals,
  nearbyMapEntitiesPage,
  nearbyMapPlaces,
  searchMapPlaces,
  type MapEntityLocation,
  type MapEntityLocationPage,
  type MapEventFilters,
  type MapProfileFilters,
  type MapPlace,
  type MapPlaceProposalRecord,
  type MapSourceFilters,
  type SourceLocationRole,
} from "./mapApi";
import MapCanvas, { entityKey } from "./MapCanvas";
import MapEntityFilterControls from "./MapEntityFilterControls";
import {
  loadSharedMapScope,
  loadOwnedMapContent,
  type OwnedMapConnection,
  type OwnedMapMarker,
} from "./ownedMapContent";
import { appendSharedMapScope, parseSharedMapScope } from "./sharedMapScope";
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
  const [includeDescendants, setIncludeDescendants] = useState(
    params.get("descendants") === "true",
  );
  const [items, setItems] = useState<MapPlace[]>([]);
  const [suggestions, setSuggestions] = useState<MapPlace[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsFailed, setSuggestionsFailed] = useState(false);
  const [entities, setEntities] = useState<MapEntityLocation[]>([]);
  const [entityNextCursor, setEntityNextCursor] = useState<string | null>(null);
  const [loadingMoreEntities, setLoadingMoreEntities] = useState(false);
  const [types, setTypes] = useState<MapEntityLocation["entityType"][]>(() =>
    parseEntityTypes(params.get("types")),
  );
  const [sourceRoles, setSourceRoles] = useState<SourceLocationRole[]>(() =>
    parseSourceRoles(params.get("sourceRoles")),
  );
  const [period, setPeriod] = useState(
    params.get("period") ||
      params.get("sourcePeriod") ||
      params.get("eventPeriod") ||
      params.get("profilePeriod") ||
      "",
  );
  const [sourceType, setSourceType] = useState(params.get("sourceType") || "");
  const [from, setFrom] = useState<HistoricalYearInput>(() =>
    parseHistoricalYear(
      params.get("from") ||
        params.get("sourceFrom") ||
        params.get("eventFrom") ||
        params.get("profileFrom"),
    ),
  );
  const [to, setTo] = useState<HistoricalYearInput>(() =>
    parseHistoricalYear(
      params.get("to") ||
        params.get("sourceTo") ||
        params.get("eventTo") ||
        params.get("profileTo"),
    ),
  );
  const [eventRoles, setEventRoles] = useState<
    Array<"VENUE" | "HISTORICAL_SITE">
  >(() => parseEventRoles(params.get("eventRoles")));
  const [profileType, setProfileType] = useState(
    params.get("profileType") || "",
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
  const [ownedConnections, setOwnedConnections] = useState<
    OwnedMapConnection[]
  >([]);
  const [showOwnedMap, setShowOwnedMap] = useState(
    () =>
      !params.get("placeId") &&
      !params.get("lat") &&
      !params.get("lng") &&
      !params.get("scope"),
  );
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [ownProposals, setOwnProposals] = useState<MapPlaceProposalRecord[]>(
    [],
  );
  const [editingProposal, setEditingProposal] =
    useState<MapPlaceProposalRecord | null>(null);
  const suggestionRequest = useRef(0);
  const profileDefaultsApplied = useRef(false);
  const sharedScope = useMemo(() => parseSharedMapScope(params), [params]);

  useEffect(() => {
    void getViewer().then(setViewer);
  }, []);

  // The horizontal-navigation map starts as a personal map. Make the owner
  // explicit as soon as identity is known, so copying the address from this
  // page keeps the original person's public graph for every recipient.
  useEffect(() => {
    if (!viewer || sharedScope) return;
    const next = new URLSearchParams(params);
    appendSharedMapScope(next, { type: "USER", id: viewer.userId });
    setParams(next, { replace: true });
  }, [params, setParams, sharedScope, viewer]);

  // Active proposals are a private author view. They are deliberately fetched
  // only after identity is known and never folded into public map results.
  useEffect(() => {
    if (!viewer) {
      setOwnProposals([]);
      return;
    }
    let active = true;
    void listMyMapPlaceProposals()
      .then((proposals) => {
        if (active) setOwnProposals(proposals);
      })
      .catch(() => {
        if (active) setOwnProposals([]);
      });
    return () => {
      active = false;
    };
  }, [viewer]);

  // A URL scope is a public page graph and wins over the recipient's private
  // "my map" overlay. Without this branch, opening a club/profile share URL
  // would silently replace the page-specific markers with the viewer's data.
  useEffect(() => {
    let active = true;
    if (sharedScope) {
      setOwnedMarkers([]);
      setOwnedConnections([]);
      void loadSharedMapScope(sharedScope)
        .then((content) => {
          if (!active) return;
          setOwnedMarkers(content.markers);
          setOwnedConnections(content.connections);
        })
        .catch(() => {
          if (active) {
            setOwnedMarkers([]);
            setOwnedConnections([]);
          }
        });
      return () => {
        active = false;
      };
    }
    // Opening the Map from horizontal navigation should be useful even before
    // a search: show the signed-in person's own graph. This is deliberately
    // separate from public, URL-addressable page slices above.
    if (!viewer || !showOwnedMap) {
      setOwnedMarkers([]);
      setOwnedConnections([]);
      return () => {
        active = false;
      };
    }
    void loadOwnedMapContent(viewer.userId, (content) => {
      if (!active) return;
      setOwnedMarkers(content.markers);
      setOwnedConnections(content.connections);
    })
      .then((content) => {
        if (!active) return;
        setOwnedMarkers(content.markers);
        setOwnedConnections(content.connections);
      })
      .catch(() => {
        // Ownership context is a convenience. Keep public map search usable
        // when an optional profile, club, or stash read is unavailable.
        if (active) {
          setOwnedMarkers([]);
          setOwnedConnections([]);
        }
      });
    return () => {
      active = false;
    };
  }, [sharedScope, showOwnedMap, viewer]);

  // A club profile represents a historical persona, so its period/range make
  // useful first defaults for discovery. Personal user profiles intentionally
  // have no historical range and therefore leave Map unfiltered.
  useEffect(() => {
    if (!viewer || profileDefaultsApplied.current) return;
    if (
      params.has("period") ||
      params.has("from") ||
      params.has("to") ||
      params.has("sourcePeriod") ||
      params.has("eventPeriod") ||
      params.has("profilePeriod")
    ) {
      profileDefaultsApplied.current = true;
      return;
    }
    let active = true;
    void Promise.all([
      getUserProfileByUserId(viewer.userId),
      getClubProfiles(viewer.userId),
    ])
      .then(([userProfile, clubProfiles]) => {
        if (!active) return;
        profileDefaultsApplied.current = true;
        const profile = resolveCurrentProfileOption(
          buildOwnedProfileOptions(userProfile, clubProfiles),
        )?.profile;
        if (!profile || profile.type !== "CLUB") return;
        setPeriod(profile.period || "");
        setFrom(
          profile.from
            ? { year: String(profile.from.year), era: profile.from.era }
            : { year: "", era: "AD" },
        );
        setTo(
          profile.to
            ? { year: String(profile.to.year), era: profile.to.era }
            : { year: "", era: "AD" },
        );
      })
      .catch(() => {
        if (active) profileDefaultsApplied.current = true;
      });
    return () => {
      active = false;
    };
  }, [params, viewer]);

  const sourceFilters: MapSourceFilters = {
    ...(period ? { period } : {}),
    ...(sourceType ? { types: [sourceType] } : {}),
    ...(toAstronomicalYear(from) !== undefined
      ? { from: toAstronomicalYear(from) }
      : {}),
    ...(toAstronomicalYear(to) !== undefined
      ? { to: toAstronomicalYear(to) }
      : {}),
  };
  const eventFilters: MapEventFilters = {
    ...(eventRoles.length ? { locationRoles: eventRoles } : {}),
    ...(period ? { period } : {}),
    ...(toAstronomicalYear(from) !== undefined
      ? { from: toAstronomicalYear(from) }
      : {}),
    ...(toAstronomicalYear(to) !== undefined
      ? { to: toAstronomicalYear(to) }
      : {}),
  };
  const profileFilters: MapProfileFilters = {
    ...(period ? { period } : {}),
    ...(profileType === "USER" || profileType === "CLUB"
      ? { types: [profileType] }
      : {}),
    ...(toAstronomicalYear(from) !== undefined
      ? { from: toAstronomicalYear(from) }
      : {}),
    ...(toAstronomicalYear(to) !== undefined
      ? { to: toAstronomicalYear(to) }
      : {}),
  };

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
      searchPlacesWithNameRange(normalized, controller.signal, from, to)
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
  }, [query, selectedPlaceId, from, to]);

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
    setShowOwnedMap(false);
    setOwnedMarkers([]);
    setOwnedConnections([]);
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
    appendEntityTypes(next, types);
    appendSourceRoles(next, sourceRoles);
    appendSourceFilters(next, sourceFilters);
    appendEventFilters(next, eventFilters);
    appendProfileFilters(next, profileFilters);
    appendHistoricalContext(next, period, from, to);
    if (showModernBorders) next.set("borders", "modern");
    if (includeDescendants) next.set("descendants", "true");
    setParams(next, { replace: true });
    setLoading(true);
    try {
      const [places, nearbyEntityPage] = await Promise.all([
        nearbyMapPlaces(selected.latitude, selected.longitude, Number(radius)),
        types.length
          ? nearbyMapEntitiesPage(
              selected.latitude,
              selected.longitude,
              Number(radius),
              types,
              contentQuery,
              undefined,
              sourceRoles,
              sourceFilters,
              eventFilters,
              includeDescendants ? selected.id : undefined,
              undefined,
              profileFilters,
            )
          : Promise.resolve<MapEntityLocationPage>({ items: [] }),
      ]);
      setItems([
        selected,
        ...places.filter((candidate) => candidate.id !== selected.id),
      ]);
      setEntities(nearbyEntityPage.items);
      setEntityNextCursor(nearbyEntityPage.nextCursor ?? null);
    } catch (caught) {
      setError((caught as Error).message || "Unable to load places.");
    } finally {
      setLoading(false);
    }
  };

  const search = async (options?: { useCurrentCoordinates?: boolean }) => {
    setError("");
    setMapError("");
    const trimmed = query.trim();
    const linkedPlaceId = options?.useCurrentCoordinates
      ? null
      : params.get("placeId");
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
    if (!isValidHistoricalRange(from, to)) {
      setError("Years must be chronological positive years.");
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
    // Keep the requested historical label in the URL. Replacing it with the
    // canonical/modern name makes a refreshed map silently lose the period
    // context the person deliberately selected.
    if (trimmed || linkedPlace?.canonicalName)
      next.set("q", trimmed || linkedPlace?.canonicalName || "");
    if (contentQuery.trim()) next.set("content", contentQuery.trim());
    appendSourceRoles(next, sourceRoles);
    appendEntityTypes(next, types);
    appendSourceFilters(next, sourceFilters);
    appendEventFilters(next, eventFilters);
    appendProfileFilters(next, profileFilters);
    appendHistoricalContext(next, period, from, to);
    if (showModernBorders) next.set("borders", "modern");
    if (includeDescendants) next.set("descendants", "true");
    // A shared page graph is part of the address, not a viewer preference.
    // This invocation is the initial URL hydration (rather than an explicit
    // new search), so retain it while loading the focal place. Otherwise a
    // pasted link briefly loads its graph and then silently replaces it with
    // the recipient's private map (or nothing when they are signed out).
    if (!options?.useCurrentCoordinates)
      appendSharedMapScope(next, sharedScope || undefined);
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
        const [places, nearbyEntityPage] = await Promise.all([
          nearbyMapPlaces(lat, lng, Number(radius)),
          types.length
            ? nearbyMapEntitiesPage(
                lat,
                lng,
                Number(radius),
                types,
                contentQuery,
                undefined,
                sourceRoles,
                sourceFilters,
                eventFilters,
                includeDescendants && linkedPlace ? linkedPlace.id : undefined,
                undefined,
                profileFilters,
              )
            : Promise.resolve<MapEntityLocationPage>({ items: [] }),
        ]);
        setItems(
          linkedPlace
            ? [
                linkedPlace,
                ...places.filter((place) => place.id !== linkedPlace?.id),
              ]
            : places,
        );
        setEntities(nearbyEntityPage.items);
        setEntityNextCursor(nearbyEntityPage.nextCursor ?? null);
      } else {
        setItems(
          (await searchPlacesWithNameRange(trimmed, undefined, from, to)).map(
            (place) => ({
              ...place,
              matchedName: matchingPlaceName(place, trimmed),
            }),
          ),
        );
        setEntities([]);
        setEntityNextCursor(null);
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

  const loadMoreEntities = async () => {
    if (loadingMoreEntities || !entityNextCursor) return;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setLoadingMoreEntities(true);
    try {
      const page = await nearbyMapEntitiesPage(
        lat,
        lng,
        Number(radius),
        types,
        contentQuery,
        undefined,
        sourceRoles,
        sourceFilters,
        eventFilters,
        includeDescendants && selectedPlaceId ? selectedPlaceId : undefined,
        entityNextCursor,
        profileFilters,
      );
      setEntities((current) => {
        const known = new Set(current.map((entity) => entityKey(entity)));
        return [
          ...current,
          ...page.items.filter((entity) => !known.has(entityKey(entity))),
        ];
      });
      setEntityNextCursor(page.nextCursor ?? null);
    } catch (caught) {
      setError((caught as Error).message || "Unable to load more content.");
    } finally {
      setLoadingMoreEntities(false);
    }
  };

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
    return null;
  }, [entities, items, latitude, longitude, selectedEntityKey]);

  // A shared graph may span several places. Once it is available, fitting its
  // markers is more useful than centering on the focal location encoded in
  // the link; MapCanvas then keeps every related profile, club and source in
  // view. Before that graph arrives, retain the focal place as feedback that
  // the copied link itself was understood.
  const mapFocus = sharedScope && ownedMarkers.length ? null : focus;

  return (
    <PageLayout
      className="map-page"
      header={{
        title: <SectionBreadcrumb items={[{ label: "Map" }]} />,
        rightContent: viewer ? (
          <div className="d-flex gap-2 flex-wrap justify-content-end">
            <Button
              type="button"
              variant="outline-dark"
              onClick={() => {
                setEditingProposal(null);
                setShowProposalModal(true);
              }}
            >
              Propose a place
            </Button>
            <Link className="btn btn-outline-dark" to="/map/admin">
              Map administration
            </Link>
          </div>
        ) : null,
      }}
    >
      <section
        className="club-panel map-discovery-panel"
        aria-label="Map place search"
      >
        <div className="map-discovery-heading">
          <h1>Discover places</h1>
          <p className="text-muted mb-0">
            Start with a place, then refine what appears on the map.
          </p>
        </div>
        <div className="map-discovery-controls">
          <Form.Group className="map-place-search-field">
            <Form.Label htmlFor="map-place-search">Place</Form.Label>
            <PlaceSearchAutocomplete
              inputId="map-place-search"
              query={query}
              onQueryChange={(value) => {
                setQuery(value);
                setSelectedPlaceId(null);
                setLatitude("");
                setLongitude("");
              }}
              results={suggestions}
              loading={suggestionsLoading}
              failed={suggestionsFailed}
              onSelect={(place) => void selectPlace(place)}
              placeholder="Rome, Constantinople…"
              ariaLabel="Place"
              resultsClassName="map-place-suggestions"
              optionClassName="map-place-suggestion"
              statusClassName="map-place-suggestions-status"
            />
          </Form.Group>
          <MapEntityFilterControls
            idPrefix="map"
            entityTypes={types}
            onEntityTypesChange={setTypes}
            period={period}
            onPeriodChange={setPeriod}
            from={from}
            onFromChange={setFrom}
            to={to}
            onToChange={setTo}
            sourceRoles={sourceRoles}
            onSourceRolesChange={setSourceRoles}
            sourceType={sourceType}
            onSourceTypeChange={setSourceType}
            eventRoles={eventRoles}
            onEventRolesChange={setEventRoles}
            profileType={profileType}
            onProfileTypeChange={setProfileType}
            additionalFilters={
              <details className="map-view-options">
                <summary>Map options</summary>
                <div className="map-view-options-content">
                  <Form.Check
                    id="map-modern-borders"
                    label="Show modern borders"
                    checked={showModernBorders}
                    onChange={(event) =>
                      setShowModernBorders(event.target.checked)
                    }
                  />
                  {selectedPlaceId && (
                    <Form.Check
                      id="map-include-descendants"
                      label="Include child places"
                      checked={includeDescendants}
                      onChange={(event) =>
                        setIncludeDescendants(event.target.checked)
                      }
                    />
                  )}
                  <Form.Group>
                    <Form.Label>Filter nearby content</Form.Label>
                    <Form.Control
                      size="sm"
                      value={contentQuery}
                      onChange={(event) => setContentQuery(event.target.value)}
                      placeholder="Name or place"
                      aria-label="Filter nearby content"
                    />
                  </Form.Group>
                  <details className="map-coordinate-options">
                    <summary>Use coordinates instead</summary>
                    <div className="map-coordinate-options-content">
                      <Form.Group>
                        <Form.Label>Latitude</Form.Label>
                        <Form.Control
                          size="sm"
                          value={latitude}
                          onChange={(event) => setLatitude(event.target.value)}
                          inputMode="decimal"
                        />
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Longitude</Form.Label>
                        <Form.Control
                          size="sm"
                          value={longitude}
                          onChange={(event) => setLongitude(event.target.value)}
                          inputMode="decimal"
                        />
                      </Form.Group>
                      <Button
                        type="button"
                        variant="outline-dark"
                        size="sm"
                        onClick={() =>
                          void search({ useCurrentCoordinates: true })
                        }
                        disabled={loading}
                      >
                        Show area
                      </Button>
                    </div>
                  </details>
                </div>
              </details>
            }
          />
          <Form.Group className="map-filter-radius mb-0">
            <Form.Label>Within</Form.Label>
            <div className="d-flex align-items-center gap-1">
              <Form.Control
                value={radius}
                onChange={(event) => setRadius(event.target.value)}
                type="number"
                min={1}
                max={200}
                size="sm"
                aria-label="Radius in kilometres"
              />
              <span className="small text-muted">km</span>
            </div>
          </Form.Group>
        </div>
        {error && (
          <Alert className="mt-3 mb-0" variant="danger">
            {error}
          </Alert>
        )}
      </section>
      {viewer && ownProposals.length > 0 && (
        <section className="club-panel mt-3" aria-label="Your place proposals">
          <h2 className="h5">Your place proposals</h2>
          <ul className="list-unstyled mb-0">
            {ownProposals.map((proposal) => (
              <li
                key={proposal.id}
                className="border-top py-2 d-flex align-items-center justify-content-between gap-3"
              >
                <div>
                  <strong>{proposal.canonicalName}</strong>
                  <span className="text-muted ms-2">
                    {proposal.status === "CHANGES_REQUESTED"
                      ? "Changes requested"
                      : "Pending review"}
                  </span>
                  {proposal.review?.note && (
                    <p className="small text-muted mb-0">
                      Reviewer: {proposal.review.note}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline-dark"
                  onClick={() => {
                    setEditingProposal(proposal);
                    setShowProposalModal(true);
                  }}
                >
                  Amend
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="club-panel mt-3" aria-label="Interactive map">
        <MapCanvas
          places={items}
          entities={entities}
          ownedMarkers={ownedMarkers}
          ownedConnections={ownedConnections}
          focus={mapFocus}
          initialFitPoints={ownedMarkers}
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
                  sourceFilters,
                  eventFilters,
                  profileFilters,
                  types,
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
          {entityNextCursor && (
            <Button
              type="button"
              variant="outline-dark"
              size="sm"
              className="mt-2"
              disabled={loadingMoreEntities}
              onClick={() => void loadMoreEntities()}
            >
              {loadingMoreEntities ? "Loading…" : "Show more"}
            </Button>
          )}
        </section>
      )}
      <PlaceProposalModal
        show={showProposalModal}
        initialLatitude={latitude}
        initialLongitude={longitude}
        proposal={editingProposal}
        onSubmitted={(proposal) =>
          setOwnProposals((current) => {
            const existing = current.findIndex(
              (item) => item.id === proposal.id,
            );
            if (existing < 0) return [proposal, ...current];
            return current.map((item) =>
              item.id === proposal.id ? proposal : item,
            );
          })
        }
        onHide={() => {
          setShowProposalModal(false);
          setEditingProposal(null);
        }}
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
    HISTORICAL_SITE: "Historical site",
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
  sourceFilters: MapSourceFilters,
  eventFilters: MapEventFilters,
  profileFilters: MapProfileFilters,
  types: MapEntityLocation["entityType"][],
): string {
  const parameters = new URLSearchParams({
    placeId: place.id,
    q: place.canonicalName,
    lat: String(place.latitude),
    lng: String(place.longitude),
    radiusKm: radius || "25",
  });
  if (contentQuery.trim()) parameters.set("content", contentQuery.trim());
  appendEntityTypes(parameters, types);
  appendSourceRoles(parameters, sourceRoles);
  appendHistoricalContextFromFilters(parameters, sourceFilters);
  appendSourceFilters(parameters, sourceFilters);
  appendEventFilters(parameters, eventFilters);
  appendProfileFilters(parameters, profileFilters);
  if (showModernBorders) parameters.set("borders", "modern");
  return `/map?${parameters.toString()}`;
}

function parseEntityTypes(
  value: string | null,
): MapEntityLocation["entityType"][] {
  if (value === "none") return [];
  if (value === null || value === "all") return entityTypes;
  return value
    .split(",")
    .filter((type): type is MapEntityLocation["entityType"] =>
      entityTypes.includes(type as MapEntityLocation["entityType"]),
    )
    .filter((type, index, all) => all.indexOf(type) === index);
}

function appendEntityTypes(
  parameters: URLSearchParams,
  types: MapEntityLocation["entityType"][],
): void {
  parameters.set(
    "types",
    types.length === 0
      ? "none"
      : types.length === entityTypes.length
        ? "all"
        : types.join(","),
  );
}

function parseSourceRoles(value: string | null): SourceLocationRole[] {
  // A source is primarily native to its find/discovery place. Deliberately
  // keep an explicit empty query value meaningful: clearing both toggles is
  // the inclusive mode that shows both find and holding locations.
  if (value === null) return ["DISCOVERED_AT"];
  if (value === "all") return [];
  return (value ?? "")
    .split(",")
    .filter(
      (role): role is SourceLocationRole =>
        role === "DISCOVERED_AT" || role === "HELD_AT",
    )
    .filter((role, index, all) => all.indexOf(role) === index);
}

function appendSourceRoles(
  parameters: URLSearchParams,
  sourceRoles: SourceLocationRole[],
): void {
  parameters.set(
    "sourceRoles",
    sourceRoles.length ? sourceRoles.join(",") : "all",
  );
}

function appendSourceFilters(
  parameters: URLSearchParams,
  filters: MapSourceFilters,
): void {
  if (filters.types?.length) parameters.set("sourceType", filters.types[0]);
}

function appendEventFilters(
  parameters: URLSearchParams,
  filters: MapEventFilters,
): void {
  if (filters.locationRoles?.length)
    parameters.set("eventRoles", filters.locationRoles.join(","));
}

function appendProfileFilters(
  parameters: URLSearchParams,
  filters: MapProfileFilters,
): void {
  if (filters.types?.length) parameters.set("profileType", filters.types[0]);
}

function parseEventRoles(
  value: string | null,
): Array<"VENUE" | "HISTORICAL_SITE"> {
  if (value === null || value === "all") return [];
  return value
    .split(",")
    .filter(
      (role): role is "VENUE" | "HISTORICAL_SITE" =>
        role === "VENUE" || role === "HISTORICAL_SITE",
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

function appendHistoricalContext(
  parameters: URLSearchParams,
  period: string,
  from: HistoricalYearInput,
  to: HistoricalYearInput,
): void {
  if (period) parameters.set("period", period);
  const start = toAstronomicalYear(from);
  const end = toAstronomicalYear(to);
  if (start !== undefined) parameters.set("from", String(start));
  if (end !== undefined) parameters.set("to", String(end));
}

function appendHistoricalContextFromFilters(
  parameters: URLSearchParams,
  filters: MapSourceFilters,
): void {
  if (filters.period) parameters.set("period", filters.period);
  if (filters.from !== undefined) parameters.set("from", String(filters.from));
  if (filters.to !== undefined) parameters.set("to", String(filters.to));
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
