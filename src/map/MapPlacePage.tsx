import { Fragment, useEffect, useState } from "react";
import { Alert, Button, ButtonGroup, Form, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";

import PageLayout from "../component/PageLayout";
import PlaceNamesList from "../component/PlaceNamesList";
import { getImageThumbnails } from "../image/imageApi";
import MapCanvas, { entityKey } from "./MapCanvas";
import { entityThumbnailMarkers } from "./entityThumbnailMarkers";
import {
  getMapPlace,
  listMapPlaceChildren,
  listMapPlaceEntities,
  type MapEntityLocation,
  type MapPlace,
} from "./mapApi";
import { formatPlaceNameRange } from "./placeNames";

type MapPlacePageProps = { id?: string };
type EntityTypeFilter = MapEntityLocation["entityType"] | "ALL";
const entityTypeFilters: EntityTypeFilter[] = [
  "ALL",
  "PROFILE",
  "CLUB",
  "EVENT",
  "SOURCE",
];

/** Public landing page for one approved canonical point. It uses the exact
 * place-assignment API rather than an imprecise radius lookup. */
export default function MapPlacePage({ id }: MapPlacePageProps) {
  const [place, setPlace] = useState<MapPlace | null | undefined>(undefined);
  const [ancestors, setAncestors] = useState<MapPlace[]>([]);
  const [otherContainmentParents, setOtherContainmentParents] = useState<
    Record<string, MapPlace>
  >({});
  const [children, setChildren] = useState<MapPlace[]>([]);
  const [childCursor, setChildCursor] = useState<string | undefined>();
  const [entities, setEntities] = useState<MapEntityLocation[]>([]);
  const [entityCursor, setEntityCursor] = useState<string | undefined>();
  const [entityCounts, setEntityCounts] = useState<
    Partial<Record<MapEntityLocation["entityType"], number>>
  >({});
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [entityType, setEntityType] = useState<EntityTypeFilter>("ALL");
  const [sourceRole, setSourceRole] = useState<
    "ALL" | "DISCOVERED_AT" | "HELD_AT"
  >("ALL");
  const [showModernBorders, setShowModernBorders] = useState(false);
  const [selectedEntityKey, setSelectedEntityKey] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setPlace(null);
      return;
    }
    const controller = new AbortController();
    setPlace(undefined);
    setAncestors([]);
    setOtherContainmentParents({});
    setEntities([]);
    setEntityCursor(undefined);
    setEntityCounts({});
    setError("");
    setEntitiesLoading(true);
    void Promise.all([
      getMapPlace(id, controller.signal),
      listMapPlaceChildren(id, controller.signal),
      listMapPlaceEntities(
        id,
        entityType === "ALL" ? [] : [entityType],
        entityType === "SOURCE" && sourceRole !== "ALL" ? [sourceRole] : [],
        controller.signal,
      ),
    ])
      .then(([nextPlace, nextChildren, nextEntities]) => {
        setPlace(nextPlace);
        setChildren(nextChildren.items);
        setChildCursor(nextChildren.nextCursor);
        setEntities(nextEntities.items);
        setEntityCursor(nextEntities.nextCursor);
        setEntityCounts(nextEntities.counts || {});
        if (nextPlace) {
          void loadPlaceAncestors(nextPlace, controller.signal).then(
            (nextAncestors) => {
              if (!controller.signal.aborted) setAncestors(nextAncestors);
            },
            () => {
              if (!controller.signal.aborted) setAncestors([]);
            },
          );
          const relatedIds = Array.from(
            new Set(
              nextPlace.containmentRelations?.map(
                (relation) => relation.parentPlaceId,
              ) || [],
            ),
          );
          if (relatedIds.length) {
            void Promise.all(
              relatedIds.map((placeId) => getMapPlace(placeId, controller.signal)),
            ).then((relatedPlaces) => {
              if (controller.signal.aborted) return;
              setOtherContainmentParents(
                Object.fromEntries(
                  relatedPlaces
                    .filter((value): value is MapPlace => Boolean(value))
                    .map((value) => [value.id, value]),
                ),
              );
            });
          }
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError((caught as Error).message || "Unable to load this place.");
          setPlace(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setEntitiesLoading(false);
      });
    return () => controller.abort();
  }, [entityType, id, sourceRole]);

  useEffect(() => {
    if (!entities.length) {
      setThumbnails({});
      return undefined;
    }
    let active = true;
    void getImageThumbnails(
      entities.map((entity) => ({
        resourceType: entity.entityType.toLowerCase(),
        resourceId: entity.entityId,
      })),
    )
      .then((items) => {
        if (!active) return;
        setThumbnails(
          Object.fromEntries(
            items.flatMap((item) => {
              const url = item.image?.thumbnailUrl || item.image?.url;
              return url
                ? [
                    [
                      `${item.resourceType.toUpperCase()}:${item.resourceId}`,
                      url,
                    ],
                  ]
                : [];
            }),
          ),
        );
      })
      .catch(() => active && setThumbnails({}));
    return () => {
      active = false;
    };
  }, [entities]);

  const loadMoreEntities = async () => {
    if (!id || !entityCursor || entitiesLoading) return;
    setEntitiesLoading(true);
    try {
      const page = await listMapPlaceEntities(
        id,
        entityType === "ALL" ? [] : [entityType],
        entityType === "SOURCE" && sourceRole !== "ALL" ? [sourceRole] : [],
        undefined,
        entityCursor,
      );
      setEntities((current) => [...current, ...page.items]);
      setEntityCursor(page.nextCursor);
      setEntityCounts(page.counts || {});
    } catch (caught) {
      setError((caught as Error).message || "Unable to load more content.");
    } finally {
      setEntitiesLoading(false);
    }
  };

  const loadMoreChildren = async () => {
    if (!id || !childCursor) return;
    try {
      const page = await listMapPlaceChildren(id, undefined, childCursor);
      setChildren((current) => [...current, ...page.items]);
      setChildCursor(page.nextCursor);
    } catch (caught) {
      setError((caught as Error).message || "Unable to load child places.");
    }
  };

  if (place === undefined)
    return (
      <PageLayout className="map-page" header={{ title: "Place" }}>
        <Spinner animation="border" size="sm" />
      </PageLayout>
    );

  if (!place)
    return (
      <PageLayout className="map-page" header={{ title: "Place" }}>
        <Alert variant="warning">
          {error || "This place is not available."}
        </Alert>
        <Link to="/map">Back to map</Link>
      </PageLayout>
    );

  return (
    <PageLayout className="map-page" header={{ title: place.canonicalName }}>
      <section className="club-panel" aria-label="Place details">
        <nav aria-label="Place hierarchy" className="small mb-2">
          <Link to="/map">Map</Link>
          {ancestors.map((ancestor) => (
            <Fragment key={ancestor.id}>
              <span className="mx-1 text-muted" aria-hidden="true">
                /
              </span>
              <Link to={`/map/place/${encodeURIComponent(ancestor.id)}`}>
                {ancestor.canonicalName}
              </Link>
            </Fragment>
          ))}
          <span className="mx-1 text-muted" aria-hidden="true">
            /
          </span>
          <span aria-current="page">{place.canonicalName}</span>
        </nav>
        <h1 className="mt-2">{place.canonicalName}</h1>
        <p className="text-muted mb-2">
          {place.featureType} · {place.latitude.toFixed(4)},{" "}
          {place.longitude.toFixed(4)}
        </p>
        {place.confidence && (
          <p className="small text-muted mb-2">
            Confidence: {place.confidence.replaceAll("_", " ").toLowerCase()}
          </p>
        )}
        {place.parentRelation && (
          <p
            className="small text-muted mb-2"
            title={
              place.parentRelation.provenance?.length
                ? place.parentRelation.provenance
                    .map(
                      (source) =>
                        `${source.dataset} (${source.externalId}) — ${source.license}`,
                    )
                    .join("; ")
                : undefined
            }
          >
            Parent relationship
            {formatPlaceNameRange(
              place.parentRelation.validFrom,
              place.parentRelation.validTo,
            )}
            {place.parentRelation.confidence
              ? ` · ${place.parentRelation.confidence
                  .replaceAll("_", " ")
                  .toLowerCase()}`
              : ""}
          </p>
        )}
        {place.containmentRelations?.length ? (
          <div className="small text-muted mb-2">
            <span className="fw-semibold">Other historical containment</span>
            {place.containmentRelations.map((relation, index) => (
              <span
                key={`${relation.parentPlaceId}-${index}`}
                className="d-block ms-2"
                title={
                  relation.provenance?.length
                    ? relation.provenance
                        .map(
                          (source) =>
                            `${source.dataset} (${source.externalId}) — ${source.license}`,
                        )
                        .join("; ")
                    : undefined
                }
              >
                <Link to={`/map/place/${encodeURIComponent(relation.parentPlaceId)}`}>
                  {otherContainmentParents[relation.parentPlaceId]
                    ?.canonicalName || relation.parentPlaceId}
                </Link>
                {formatPlaceNameRange(relation.validFrom, relation.validTo)}
                {relation.confidence
                  ? ` · ${relation.confidence.replaceAll("_", " ").toLowerCase()}`
                  : ""}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mb-2">
          <Link
            to={`/map?placeId=${encodeURIComponent(place.id)}&descendants=true`}
          >
            Explore this place and child places on the map
          </Link>
        </p>
        {children.length > 0 && (
          <div className="small mb-2">
            Contains{" "}
            {children.map((child, index) => (
              <Fragment key={child.id}>
                {index > 0 && ", "}
                <Link to={`/map/place/${encodeURIComponent(child.id)}`}>
                  {child.canonicalName}
                </Link>
              </Fragment>
            ))}
            {childCursor && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="p-0 ms-1 align-baseline"
                onClick={() => void loadMoreChildren()}
              >
                Show more
              </Button>
            )}
          </div>
        )}
        {place.description && <p className="mb-2">{place.description}</p>}
        <Form.Check
          id="place-modern-borders"
          label="Modern borders"
          checked={showModernBorders}
          onChange={(event) => setShowModernBorders(event.target.checked)}
        />
      </section>
      <section
        className="club-panel mt-3"
        aria-label="Place names and provenance"
      >
        <h2 className="h5">Names</h2>
        <PlaceNamesList place={place} />
        {(place.periods?.length || place.selectionReasons?.length) && (
          <dl className="row mb-0 mt-3 small">
            {place.periods?.length ? (
              <>
                <dt className="col-sm-3">Periods</dt>
                <dd className="col-sm-9">{place.periods.join(", ")}</dd>
              </>
            ) : null}
            {place.selectionReasons?.length ? (
              <>
                <dt className="col-sm-3">Included because</dt>
                <dd className="col-sm-9">
                  {place.selectionReasons.join(", ")}
                </dd>
              </>
            ) : null}
          </dl>
        )}
        {place.provenance?.length ? (
          <>
            <h3 className="h6 mt-3">Sources</h3>
            <ul className="mb-0">
              {place.provenance.map((source) => (
                <li key={`${source.dataset}:${source.externalId}`}>
                  {source.dataset} ({source.externalId}) — {source.license}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
      <section className="club-panel mt-3" aria-label="Place on map">
        <MapCanvas
          places={[place]}
          entities={entities}
          thumbnailMarkers={entityThumbnailMarkers(entities, thumbnails)}
          focus={{ latitude: place.latitude, longitude: place.longitude }}
          showModernBorders={showModernBorders}
          selectedEntityKey={selectedEntityKey}
          selectedPlaceId={place.id}
          onEntitySelect={setSelectedEntityKey}
          onThumbnailMarkerSelect={(marker) =>
            setSelectedEntityKey(
              `${marker.entityType}:${marker.entityId}:${marker.locationRole}`,
            )
          }
          onMapError={(message) => setError(message)}
        />
        {error && <p className="small text-muted mt-2 mb-0">{error}</p>}
      </section>
      <section
        className="club-panel mt-3"
        aria-label="Public content at this place"
      >
        <h2 className="h5">At this place</h2>
        <ButtonGroup className="mb-2 flex-wrap" aria-label="Content type">
          {entityTypeFilters.map((type) => (
            <Button
              key={type}
              type="button"
              size="sm"
              variant={entityType === type ? "dark" : "outline-dark"}
              onClick={() => setEntityType(type)}
            >
              {type === "ALL"
                ? `All (${Object.values(entityCounts).reduce((total, count) => total + (count || 0), 0)})`
                : `${type[0] + type.slice(1).toLowerCase()} (${entityCounts[type] || 0})`}
            </Button>
          ))}
        </ButtonGroup>
        {entityType === "SOURCE" && (
          <Form.Select
            aria-label="Source role"
            size="sm"
            className="mb-2"
            value={sourceRole}
            onChange={(event) =>
              setSourceRole(
                event.target.value as "ALL" | "DISCOVERED_AT" | "HELD_AT",
              )
            }
          >
            <option value="ALL">All source locations</option>
            <option value="DISCOVERED_AT">Discovered here</option>
            <option value="HELD_AT">Held here</option>
          </Form.Select>
        )}
        {entities.length === 0 ? (
          <p className="text-muted mb-0">
            {entitiesLoading
              ? "Loading public content…"
              : "No public content is assigned here yet."}
          </p>
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
                  {entity.entityType[0] +
                    entity.entityType.slice(1).toLowerCase()}{" "}
                  · {roleLabel(entity)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {entityCursor && (
          <Button
            type="button"
            size="sm"
            variant="outline-dark"
            className="mt-2"
            disabled={entitiesLoading}
            onClick={() => void loadMoreEntities()}
          >
            {entitiesLoading ? "Loading…" : "Show more"}
          </Button>
        )}
      </section>
    </PageLayout>
  );
}

/** Resolve a bounded primary hierarchy for breadcrumb navigation. The map
 * service already rejects cyclic imports; this client guard also prevents a
 * malformed response from creating an endless chain in a public page. */
export async function loadPlaceAncestors(
  place: MapPlace,
  signal?: AbortSignal,
): Promise<MapPlace[]> {
  const ancestors: MapPlace[] = [];
  const seen = new Set([place.id]);
  let parentId = place.parentPlaceId;

  while (parentId && ancestors.length < 16 && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = await getMapPlace(parentId, signal);
    if (!parent) break;
    ancestors.push(parent);
    parentId = parent.parentPlaceId;
  }

  return ancestors.reverse();
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
    HISTORICAL_SITE: "Historical site",
    DISCOVERED_AT: "Discovered at",
    HELD_AT: "Held at",
  }[entity.locationRole];
}
