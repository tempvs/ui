import { useEffect, useState } from "react";
import { Alert, Form, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";

import PageLayout from "../component/PageLayout";
import MapCanvas, { entityKey } from "./MapCanvas";
import {
  getMapPlace,
  listMapPlaceEntities,
  type MapEntityLocation,
  type MapPlace,
} from "./mapApi";

type MapPlacePageProps = { id?: string };

/** Public landing page for one approved canonical point. It uses the exact
 * place-assignment API rather than an imprecise radius lookup. */
export default function MapPlacePage({ id }: MapPlacePageProps) {
  const [place, setPlace] = useState<MapPlace | null | undefined>(undefined);
  const [entities, setEntities] = useState<MapEntityLocation[]>([]);
  const [showModernBorders, setShowModernBorders] = useState(false);
  const [selectedEntityKey, setSelectedEntityKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setPlace(null);
      return;
    }
    const controller = new AbortController();
    setPlace(undefined);
    setError("");
    void Promise.all([
      getMapPlace(id, controller.signal),
      listMapPlaceEntities(id, [], controller.signal),
    ])
      .then(([nextPlace, nextEntities]) => {
        setPlace(nextPlace);
        setEntities(nextEntities);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError((caught as Error).message || "Unable to load this place.");
          setPlace(null);
        }
      });
    return () => controller.abort();
  }, [id]);

  if (place === undefined)
    return (
      <PageLayout className="map-page" header={{ title: "Place" }}>
        <Spinner animation="border" size="sm" />
      </PageLayout>
    );

  if (!place)
    return (
      <PageLayout className="map-page" header={{ title: "Place" }}>
        <Alert variant="warning">{error || "This place is not available."}</Alert>
        <Link to="/map">Back to map</Link>
      </PageLayout>
    );

  return (
    <PageLayout className="map-page" header={{ title: place.canonicalName }}>
      <section className="club-panel" aria-label="Place details">
        <Link className="small" to={`/map?placeId=${encodeURIComponent(place.id)}`}>
          Back to map discovery
        </Link>
        <h1 className="mt-2">{place.canonicalName}</h1>
        <p className="text-muted mb-2">
          {place.featureType} · {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
        </p>
        <Form.Check
          id="place-modern-borders"
          label="Modern borders"
          checked={showModernBorders}
          onChange={(event) => setShowModernBorders(event.target.checked)}
        />
      </section>
      <section className="club-panel mt-3" aria-label="Place on map">
        <MapCanvas
          places={[place]}
          entities={entities}
          focus={{ latitude: place.latitude, longitude: place.longitude }}
          showModernBorders={showModernBorders}
          selectedEntityKey={selectedEntityKey}
          onEntitySelect={setSelectedEntityKey}
          onMapError={(message) => setError(message)}
        />
        {error && <p className="small text-muted mt-2 mb-0">{error}</p>}
      </section>
      <section className="club-panel mt-3" aria-label="Public content at this place">
        <h2 className="h5">At this place</h2>
        {entities.length === 0 ? (
          <p className="text-muted mb-0">No public content is assigned here yet.</p>
        ) : (
          <ul className="list-unstyled mb-0">
            {entities.map((entity) => (
              <li
                key={entityKey(entity)}
                className={`border-top py-2 ${selectedEntityKey === entityKey(entity) ? "map-result-selected" : ""}`}
                onClick={() => setSelectedEntityKey(entityKey(entity))}
              >
                <Link to={entityPath(entity)}>{entity.label}</Link>
                <span className="text-muted ms-2">
                  {entity.entityType[0] + entity.entityType.slice(1).toLowerCase()} · {roleLabel(entity)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
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

function roleLabel(entity: MapEntityLocation): string {
  return {
    CURRENT_RESIDENCE: "Residence",
    CLUB_ASSOCIATION: "Associated place",
    VENUE: "Venue",
    DISCOVERED_AT: "Discovered at",
    HELD_AT: "Held at",
  }[entity.locationRole];
}
