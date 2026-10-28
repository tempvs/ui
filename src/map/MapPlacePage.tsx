import { Fragment, useEffect, useState } from "react";
import { Alert, Button, ButtonGroup, Form } from "react-bootstrap";
import { Link } from "react-router-dom";

import { getViewer, type Viewer } from "../auth/viewerApi";
import PageLayout from "../component/PageLayout";
import PlaceNamesList from "../component/PlaceNamesList";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import Spinner from "../component/Spinner";
import ChangeLogEntry from "../component/ChangeLogEntry";
import { getImageThumbnails } from "../image/imageApi";
import { getUserProfilesByUserIds } from "../profile/profileApi";
import type { Profile } from "../profile/profileTypes";
import MapCanvas, { entityKey } from "./MapCanvas";
import { entityThumbnailMarkers } from "./entityThumbnailMarkers";
import {
  getMapPlace,
  listMapPlaceChildren,
  listMapPlaceEntities,
  listMapPlaceHistory,
  type MapPlaceProposalActivity,
  type MapEntityLocation,
  type MapPlace,
  type MapPlaceName,
} from "./mapApi";
import { formatPlaceNameRange } from "./placeNames";
import MapPlaceChangeLogDiffModal from "./MapPlaceChangeLogDiffModal";

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
  const [viewer, setViewer] = useState<Viewer | null | undefined>(undefined);
  const [place, setPlace] = useState<MapPlace | null | undefined>(undefined);
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
  const [history, setHistory] = useState<MapPlaceProposalActivity[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | undefined>();
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyProfiles, setHistoryProfiles] = useState<
    Record<string, Profile>
  >({});
  const [selectedHistory, setSelectedHistory] =
    useState<MapPlaceProposalActivity | null>(null);

  useEffect(() => {
    void getViewer().then(setViewer);
  }, []);

  useEffect(() => {
    if (!id) {
      setPlace(null);
      return;
    }
    const controller = new AbortController();
    setPlace(undefined);
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
      listMapPlaceHistory(id, undefined),
    ])
      .then(([nextPlace, nextChildren, nextEntities, nextHistory]) => {
        setPlace(nextPlace);
        setChildren(nextChildren.items);
        setChildCursor(nextChildren.nextCursor);
        setEntities(nextEntities.items);
        setEntityCursor(nextEntities.nextCursor);
        setEntityCounts(nextEntities.counts || {});
        setHistory(nextHistory.items);
        setHistoryCursor(nextHistory.nextCursor);
        if (nextPlace) {
          const relatedIds = Array.from(
            new Set(
              nextPlace.containmentRelations?.map(
                (relation) => relation.parentPlaceId,
              ) || [],
            ),
          );
          if (relatedIds.length) {
            void Promise.all(
              relatedIds.map((placeId) =>
                getMapPlace(placeId, controller.signal),
              ),
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

  useEffect(() => {
    const userIds = Array.from(
      new Set(history.map((entry) => entry.actorUserId)),
    );
    if (!userIds.length) return;
    void getUserProfilesByUserIds(userIds)
      .then((profiles) =>
        setHistoryProfiles(
          Object.fromEntries(
            profiles
              .filter((profile) => Boolean(profile.userId))
              .map((profile) => [String(profile.userId), profile]),
          ),
        ),
      )
      .catch(() => undefined);
  }, [history]);

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

  const loadMoreHistory = async () => {
    if (!id || !historyCursor || historyLoading) return;
    setHistoryLoading(true);
    try {
      const page = await listMapPlaceHistory(id, historyCursor);
      setHistory((current) => [...current, ...page.items]);
      setHistoryCursor(page.nextCursor);
    } catch (caught) {
      setError((caught as Error).message || "Unable to load more history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const canPropose = Boolean(
    viewer?.roles.some((role) =>
      ["TEMPVS_ADMIN", "MAP_ADMIN", "MAP_EDITOR", "MAP_REVIEWER"].includes(
        role,
      ),
    ),
  );

  if (place === undefined)
    return (
      <PageLayout className="map-page" header={{ title: "Place" }}>
        <Spinner size="sm" />
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

  const historicalNames = otherHistoricalNames(place);
  const contentCount = Object.values(entityCounts).reduce(
    (total, count) => total + (count || 0),
    0,
  );
  const timelineEvents = [...(place.historicalEvents || [])].sort(
    (left, right) =>
      (left.validFrom ?? left.validTo ?? Number.POSITIVE_INFINITY) -
      (right.validFrom ?? right.validTo ?? Number.POSITIVE_INFINITY),
  );

  return (
    <PageLayout
      className="map-page"
      header={{
        title: (
          <SectionBreadcrumb
            items={[
              { label: "Map", to: "/map" },
              { label: place.canonicalName },
            ]}
          />
        ),
        rightContent: canPropose ? (
          <div className="d-flex gap-2 flex-wrap justify-content-end">
            <Link
              to={`/map/place/${encodeURIComponent(place.id)}/proposals`}
              className="btn btn-outline-dark btn-sm"
            >
              Pending proposals
            </Link>
            <Link
              to={`/map/place/${encodeURIComponent(place.id)}/edit`}
              className="btn btn-dark btn-sm"
            >
              Propose edit
            </Link>
          </div>
        ) : null,
      }}
    >
      <section className="club-panel" aria-label="Place details">
        <h1>{place.canonicalName}</h1>
        <div className="place-at-a-glance" aria-label="Place at a glance">
          <div>
            <span>Type</span>
            <strong>{place.featureType.replaceAll("_", " ")}</strong>
          </div>
          <div>
            <span>Location</span>
            <strong>
              {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
            </strong>
          </div>
          {place.periods?.length ? (
            <div>
              <span>Periods</span>
              <strong>{place.periods.join(", ")}</strong>
            </div>
          ) : null}
          <a href="#place-content">
            <span>Linked content</span>
            <strong>{contentCount}</strong>
          </a>
        </div>
        {historicalNames.length > 0 && (
          <div className="mb-3" aria-label="Historical names">
            <h2 className="h6 mb-1">Historical names</h2>
            <ul className="list-unstyled mb-0">
              {historicalNames.map((name, index) => (
                <li
                  key={`${name.value}:${name.language ?? ""}:${name.validFrom ?? ""}:${name.validTo ?? ""}:${index}`}
                >
                  {name.value}
                  {formatPlaceNameRange(name.validFrom, name.validTo)}
                </li>
              ))}
            </ul>
          </div>
        )}
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
                <Link
                  to={`/map/place/${encodeURIComponent(relation.parentPlaceId)}`}
                >
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
        {timelineEvents.length ? (
          <div className="mb-2" aria-label="Important dates and events">
            <h2 className="h6 mb-1">Timeline</h2>
            <ol className="place-timeline mb-0 ps-3">
              {timelineEvents.map((event, index) => (
                <li
                  key={`${event.description}-${event.validFrom ?? ""}-${event.validTo ?? ""}-${index}`}
                >
                  <span className="fw-semibold">
                    {formatPlaceNameRange(
                      event.validFrom,
                      event.validTo,
                    ).trim()}
                  </span>{" "}
                  {event.description}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
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
        <details>
          <summary className="h5 mb-0">Names and provenance</summary>
          <div className="mt-3">
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
          </div>
        </details>
      </section>
      <section className="club-panel mt-3" aria-label="Place edit history">
        <h2 className="h5">Edit history</h2>
        <p className="small text-muted">
          Every proposed edit and review decision is retained here.
        </p>
        {history.length === 0 ? (
          <p className="text-muted mb-0">No recorded edits yet.</p>
        ) : (
          <ol className="mb-0 ps-3">
            {history.map((entry) => (
              <li key={entry.id} className="mb-2">
                <ChangeLogEntry
                  actorUserId={entry.actorUserId}
                  proposerUserId={proposalAuthor(history, entry)}
                  action={historyLabel(entry.kind)}
                  occurredAt={entry.occurredAt}
                  currentUserId={viewer?.userId}
                  profiles={historyProfiles}
                  {...(entry.revision
                    ? { onDetails: () => setSelectedHistory(entry) }
                    : {})}
                />
                <span className="visually-hidden">
                  {entry.actorUserId}
                  {" · "}
                  <time dateTime={entry.occurredAt}>
                    {new Date(entry.occurredAt).toLocaleString()}
                  </time>
                </span>
                {entry.globalAdminOverride && " · Tempvs admin override"}
                {entry.note && (
                  <div className="small text-muted">{entry.note}</div>
                )}
                {entry.revision && (
                  <div className="small text-muted">
                    {entry.revision.changeKind || "UPDATE"}:{" "}
                    {entry.revision.canonicalName}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {historyCursor && (
          <Button
            size="sm"
            variant="outline-dark"
            className="mt-2"
            disabled={historyLoading}
            onClick={() => void loadMoreHistory()}
          >
            {historyLoading ? "Loading…" : "Show more"}
          </Button>
        )}
      </section>
      <MapPlaceChangeLogDiffModal
        entry={selectedHistory}
        previous={previousRevision(history, selectedHistory)}
        onHide={() => setSelectedHistory(null)}
      />
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
        id="place-content"
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

function historyLabel(kind: MapPlaceProposalActivity["kind"]): string {
  return {
    SUBMITTED: "Edit proposed",
    AMENDED: "Edit amended",
    CHANGES_REQUESTED: "Changes requested",
    APPROVED: "Edit approved",
    REJECTED: "Edit rejected",
    MERGED: "Places merged",
    COMMENTED: "Comment added",
  }[kind];
}

function previousRevision(
  history: MapPlaceProposalActivity[],
  entry: MapPlaceProposalActivity | null,
) {
  if (!entry) return undefined;
  const index = history.findIndex((candidate) => candidate.id === entry.id);
  for (let current = index - 1; current >= 0; current -= 1) {
    if (history[current].revision) return history[current].revision;
  }
  return undefined;
}

function proposalAuthor(
  history: MapPlaceProposalActivity[],
  entry: MapPlaceProposalActivity,
): string | undefined {
  if (
    !["APPROVED", "REJECTED", "CHANGES_REQUESTED", "MERGED"].includes(
      entry.kind,
    )
  )
    return undefined;
  return history.find(
    (candidate) =>
      candidate.placeId === entry.placeId && candidate.kind === "SUBMITTED",
  )?.actorUserId;
}

/** Names other than the canonical label are historical/contextual labels and
 * belong in the page summary. Preserve separate dated records for one
 * spelling: each can carry distinct evidence and an historical interval. */
export function otherHistoricalNames(place: MapPlace): MapPlaceName[] {
  const canonicalName = place.canonicalName.trim().toLocaleLowerCase();
  return (place.names || []).filter(
    (name) => name.value.trim().toLocaleLowerCase() !== canonicalName,
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
    HISTORICAL_SITE: "Historical site",
    DISCOVERED_AT: "Discovered at",
    HELD_AT: "Held at",
  }[entity.locationRole];
}
