import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import {
  FaFloppyDisk as FloppyDiskIcon,
  FaLink as LinkIcon,
  FaPaperPlane as PaperPlaneIcon,
} from "react-icons/fa6";
import { FaGlobeAmericas as GlobeIcon } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import MapCanvas from "./LazyMapCanvas";
import StaticMapPreview from "./StaticMapPreview";
import {
  saveMapSnapshot,
  type MapEntityLocation,
} from "./mapApi";
import { stageMapAttachment } from "./pendingMapAttachment";
import { filterOwnedMapContentByProfiles, loadSharedMapScope, type OwnedMapContent } from "./ownedMapContent";
import type { SharedMapScope } from "./sharedMapScope";
import { getViewer } from "../auth/viewerApi";
import {
  fetchClubProfiles,
  getUserProfileByUserId,
} from "../profile/profileApi";
import ProfileSearchPicker from "../profile/components/ProfileSearchPicker";
import type { Profile } from "../profile/profileTypes";
import { getProfileClubs, type Club } from "../club/clubApi";

const Globe = GlobeIcon as React.ComponentType<{ "aria-hidden"?: boolean }>;
const Copy = LinkIcon as React.ComponentType<{ "aria-hidden"?: boolean }>;
const Save = FloppyDiskIcon as React.ComponentType<{ "aria-hidden"?: boolean }>;
const Send = PaperPlaneIcon as React.ComponentType<{ "aria-hidden"?: boolean }>;

const entityTypes: MapEntityLocation["entityType"][] = [
  "PROFILE",
  "CLUB",
  "EVENT",
  "SOURCE",
];

/** A bounded map viewport that can be stored in a post or chat message.
 * Scope is an explicitly approved, shareable resource graph. The resource
 * APIs resolve it for the current recipient and omit unreadable data. */
export type PublicMapReference = {
  placeId?: string;
  placeName?: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  entityTypes: MapEntityLocation["entityType"][];
  query?: string;
  hiddenProfileIds?: string[];
  scope?: SharedMapScope;
};

export function publicMapReferencePath(reference: PublicMapReference): string {
  const params = new URLSearchParams({
    lat: String(reference.latitude),
    lng: String(reference.longitude),
    radiusKm: String(reference.radiusKm),
    types:
      reference.entityTypes.length === entityTypes.length
        ? "all"
        : reference.entityTypes.join(","),
  });
  if (reference.placeId) params.set("placeId", reference.placeId);
  if (reference.placeName) params.set("q", reference.placeName);
  if (reference.query) params.set("content", reference.query);
  if (reference.scope) {
    params.set("scope", reference.scope.type);
    params.set("scopeId", reference.scope.id);
  }
  if (reference.hiddenProfileIds?.length)
    params.set("hiddenProfiles", reference.hiddenProfileIds.join(","));
  return `/map?${params.toString()}`;
}

/** Parse a copied map URL into the shareable server-side attachment shape. */
export function publicMapReferenceFromUrl(
  value: string,
): PublicMapReference | null {
  const input = value.trim();
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin || url.pathname !== "/map")
    return null;
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lng"));
  const radiusKm = Number(url.searchParams.get("radiusKm") || 25);
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isFinite(radiusKm) ||
    radiusKm < 1 ||
    radiusKm > 200
  )
    return null;
  const parameterTypes = url.searchParams.get("types");
  const selectedTypes =
    !parameterTypes || parameterTypes === "all"
      ? entityTypes
      : parameterTypes
          .split(",")
          .filter((type): type is MapEntityLocation["entityType"] =>
            entityTypes.includes(type as MapEntityLocation["entityType"]),
          );
  if (!selectedTypes.length) return null;
  const text = (name: string, maximum: number) => {
    const next = url.searchParams.get(name)?.trim();
    return next && next.length <= maximum ? next : undefined;
  };
  const placeId = text("placeId", 256);
  const placeName = text("q", 200);
  const query = text("content", 200);
  const hiddenProfileIds = parseHiddenProfileIds(url.searchParams.get("hiddenProfiles"));
  const scopeType = url.searchParams.get("scope");
  const scopeId = url.searchParams.get("scopeId")?.trim();
  if ((scopeType || scopeId) && (!scopeId || !isScopeType(scopeType)))
    return null;
  return {
    ...(placeId ? { placeId } : {}),
    ...(placeName ? { placeName } : {}),
    latitude,
    longitude,
    radiusKm,
    entityTypes: Array.from(new Set(selectedTypes)),
    ...(query ? { query } : {}),
    ...(hiddenProfileIds.length ? { hiddenProfileIds } : {}),
    ...(scopeId && scopeType
      ? { scope: { type: scopeType as SharedMapScope["type"], id: scopeId } }
      : {}),
  };
}

export default function MapReferenceAttachment({
  reference,
  className = "",
  relationshipScope,
}: {
  reference: PublicMapReference;
  className?: string;
  /** Used only for old attachments without their own originating scope. */
  relationshipScope?: SharedMapScope;
}) {
  const [mapError, setMapError] = useState(false);
  const [show, setShow] = useState(false);
  const showRef = useRef(show);
  showRef.current = show;
  const [modalMapReady, setModalMapReady] = useState(false);
  const [status, setStatus] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareDestination, setShareDestination] = useState<
    "chat" | "profile" | "club"
  >("chat");
  const [shareProfiles, setShareProfiles] = useState<Profile[]>([]);
  const [shareClubs, setShareClubs] = useState<Club[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const mapNavigationStarted = useRef(false);
  const navigate = useNavigate();
  const relationshipScopeType = relationshipScope?.type;
  const relationshipScopeId = relationshipScope?.id;
  const stableRelationshipScope = useMemo(
    () =>
      relationshipScopeType && relationshipScopeId
        ? { type: relationshipScopeType, id: relationshipScopeId }
        : undefined,
    [relationshipScopeId, relationshipScopeType],
  );
  const resolvedReference = useMemo(
    () =>
      reference.scope || !stableRelationshipScope
        ? reference
        : { ...reference, scope: stableRelationshipScope },
    [reference, stableRelationshipScope],
  );
  const path = publicMapReferencePath(resolvedReference);
  const name = reference.placeName || "Shared map";
  const openInMap = (event?: React.SyntheticEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (mapNavigationStarted.current) return;
    mapNavigationStarted.current = true;
    setShow(false);
    navigate(path);
  };
  const closeThenNavigate = (pathname: string, state: unknown) => {
    setShow(false);
    // Let Bootstrap remove its focus trap before changing pages. On touch
    // browsers, navigating in the same event that closes a portal modal can
    // leave the invisible backdrop above the destination composer.
    window.setTimeout(() => navigate(pathname, { state }), 0);
  };
  const sendTo = (
    pathname: string,
    target?: { type: "PROFILE" | "CLUB"; id: string },
  ) => {
    stageMapAttachment(resolvedReference, undefined, target);
    setShowShare(false);
    closeThenNavigate(
      pathname,
      target
        ? { mapAttachment: resolvedReference, mapTarget: target }
        : { composeMap: true },
    );
  };
  const save = async () => {
    const title = window.prompt("Name this saved map", name);
    if (!title?.trim()) return;
    try {
      await saveMapSnapshot({ title: title.trim(), reference: resolvedReference });
      setStatus("Saved to your maps.");
    } catch {
      setStatus("Unable to save this map.");
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setStatus("Map link copied.");
    } catch {
      setStatus("Copy the link from the opened map instead.");
    }
  };
  useEffect(() => {
    if (!show) return undefined;
    let active = true;
    void getViewer()
      .then((viewer) => {
        if (active) setAuthenticated(Boolean(viewer));
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      });
    return () => {
      active = false;
    };
  }, [show]);
  useEffect(() => {
    if (!showShare || !authenticated) return;
    let active = true;
    setShareLoading(true);
    void getViewer()
      .then(async (viewer) => {
        if (!viewer || !active) return;
        const [personal, clubProfiles] = await Promise.all([
          getUserProfileByUserId(viewer.userId).catch(() => null),
          new Promise<Profile[]>((resolve) =>
            fetchClubProfiles(viewer.userId, {
              onSuccess: (profiles) => resolve(profiles || []),
              onError: () => resolve([]),
            }),
          ),
        ]);
        if (!active) return;
        const profiles = [...(personal ? [personal] : []), ...clubProfiles];
        setShareProfiles(profiles);
        if (shareDestination !== "club") return;
        const groups = await Promise.all(
          profiles.map((profile) => getProfileClubs(profile.id).catch(() => [])),
        );
        if (active)
          setShareClubs(
            Array.from(
              new Map(groups.flat().map((club) => [String(club.id), club])).values(),
            ),
          );
      })
      .finally(() => {
        if (active) setShareLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authenticated, shareDestination, showShare]);
  return (
    <>
      <section
        className={`map-reference-attachment ${className}`.trim()}
        aria-label={`Map: ${name}`}
      >
        <div
          className="map-reference-open"
          role="button"
          tabIndex={0}
          onClick={(event) => {
            // React events from a Bootstrap Modal portal still bubble through
            // this card's component tree. Without this guard, the close
            // button/backdrop sets show=false and then this handler instantly
            // opens the same modal again.
            const target = event.target as Element;
            if (target.closest(".modal, .modal-backdrop")) return;
            setShow(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setShow(true);
            }
          }}
          aria-label={`Open shared map: ${name}`}
        >
          <div className="map-reference-heading">
            <strong>{name}</strong>
            <span className="text-muted small">
              {reference.radiusKm} km · {reference.entityTypes.length} layer
              {reference.entityTypes.length === 1 ? "" : "s"}
            </span>
          </div>
          {!mapError && (
            <MapPreview
              reference={resolvedReference}
              staticPreview
              onError={() => setMapError(true)}
            />
          )}
          {mapError && (
            <p className="small text-muted mb-1 px-2">
              Map preview unavailable. Open the map for the full view.
            </p>
          )}
        </div>
        <button
          type="button"
          className="map-reference-open-link"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={openInMap}
          onClick={openInMap}
        >
          Open in Map
        </button>
      </section>
      <Modal
        show={show}
        onHide={() => setShow(false)}
        onEnter={() => setModalMapReady(false)}
        onEntered={() => setModalMapReady(true)}
        onExited={() => {
          if (!showRef.current) setModalMapReady(false);
        }}
        centered
        size="xl"
        dialogClassName="map-reference-modal-dialog"
      >
        <Modal.Header closeButton>
          <Modal.Title>{name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="map-reference-modal-canvas">
            {show && modalMapReady && <MapPreview
              reference={resolvedReference}
              eager
              onError={() => setStatus("Map preview unavailable.")}
            />}
          </div>
          {status && <p className="small text-muted mt-2 mb-0">{status}</p>}
        </Modal.Body>
        <Modal.Footer className="map-reference-modal-footer">
          <Button
            variant="outline-dark"
            title="Open in Map"
            aria-label="Open in Map"
            onClick={() => {
              openInMap();
            }}
          >
            <Globe aria-hidden />
          </Button>
          <Button
            variant="outline-dark"
            title="Copy map link"
            aria-label="Copy map link"
            onClick={() => void copy()}
          >
            <Copy aria-hidden />
          </Button>
          {authenticated && (
            <Button
              variant="outline-dark"
              title="Save map"
              aria-label="Save map"
              onClick={() => void save()}
            >
              <Save aria-hidden />
            </Button>
          )}
          {authenticated && (
            <Button
              variant="dark"
              title="Send map"
              aria-label="Send map"
              onClick={() => {
                setShareDestination("chat");
                setShow(false);
                setShowShare(true);
              }}
            >
              <Send aria-hidden />
            </Button>
          )}
        </Modal.Footer>
      </Modal>
      <Modal show={showShare} onHide={() => setShowShare(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Send this map</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Choose where to post this map.</p>
          <div className="d-flex gap-2 flex-wrap">
            <Button
              variant={shareDestination === "chat" ? "dark" : "outline-dark"}
              onClick={() => setShareDestination("chat")}
            >
              Chat
            </Button>
            <Button
              variant={shareDestination === "profile" ? "dark" : "outline-dark"}
              onClick={() => setShareDestination("profile")}
            >
              Profile wall
            </Button>
            <Button
              variant={shareDestination === "club" ? "dark" : "outline-dark"}
              onClick={() => setShareDestination("club")}
            >
              Club wall
            </Button>
          </div>
          <div className="mt-3">
            {shareDestination === "chat" && (
              <Button variant="dark" onClick={() => sendTo("/chat")}>
                Choose chat recipient
              </Button>
            )}
            {shareDestination === "profile" && (
              shareLoading ? (
                <span className="small text-muted">Loading profiles…</span>
              ) : (
                <ProfileSearchPicker
                  ownedProfiles={shareProfiles}
                  includeOwnedMatchesWhenSearching={false}
                  placeholder="Search profiles by name or alias"
                  selectLabel="Post map"
                  onSelect={(profile) =>
                    sendTo(`/profile/${profile.alias || profile.id}`, {
                      type: "PROFILE",
                      id: String(profile.id),
                    })
                  }
                />
              )
            )}
            {shareDestination === "club" && (
              shareLoading ? (
                <span className="small text-muted">Loading clubs…</span>
              ) : shareClubs.length ? (
                <div className="d-flex flex-column gap-2">
                  {shareClubs.map((club) => (
                    <Button
                      key={club.id}
                      variant="outline-dark"
                      className="text-start"
                      onClick={() =>
                        sendTo(`/clubs/${club.alias || club.id}`, {
                          type: "CLUB",
                          id: String(club.id),
                        })
                      }
                    >
                      {club.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <span className="small text-muted">No managed club walls found.</span>
              )
            )}
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}

function MapPreview({
  reference,
  eager = false,
  staticPreview = false,
  onError,
}: {
  reference: PublicMapReference;
  eager?: boolean;
  staticPreview?: boolean;
  onError: () => void;
}) {
  const [content, setContent] = useState<OwnedMapContent>({
    markers: [],
    connections: [],
  });
  const [entities, setEntities] = useState<MapEntityLocation[]>([]);
  const [contentReady, setContentReady] = useState(false);
  const [visible, setVisible] = useState(
    () => eager || typeof IntersectionObserver === "undefined",
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const loadedContentKey = useRef<string | null>(null);
  const contentKey = JSON.stringify(reference);
  useEffect(() => {
    if (eager || typeof IntersectionObserver === "undefined") return undefined;
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
      },
      { rootMargin: "160px 0px" },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [eager, visible]);
  useEffect(() => {
    if (!visible || loadedContentKey.current === contentKey) return;
    let active = true;
    setContentReady(false);
    setContent({ markers: [], connections: [] });
    setEntities([]);
    // A scoped snapshot already describes the exact public graph being
    // shared. Loading the generic nearby layer as well is redundant and, on a
    // club wall with several embedded maps, creates an avoidable Map API
    // request burst. Unscoped copied map links retain nearby discovery.
    if (reference.scope) {
      void loadSharedMapScope(reference.scope)
        .then((part) => {
          if (active) {
            setContent(filterOwnedMapContentByProfiles(part, reference.hiddenProfileIds || []));
            setContentReady(true);
            loadedContentKey.current = contentKey;
          }
        })
        .catch(() => {
          if (active) setContentReady(true);
          onError();
        });
    } else {
      // Attachments without a saved scope are a focal place only. Loading an
      // open-ended nearby-entity query for every card makes feeds and mobile
      // modals expensive, and is not part of the map the author shared.
      setContentReady(true);
      loadedContentKey.current = contentKey;
    }
    return () => {
      active = false;
    };
  }, [
    contentKey,
    onError,
    reference,
    visible,
  ]);
  const fitPoints = embeddedMapFitPoints(reference, content, entities);
  const hasVisibleMapContent = content.markers.length > 0 || entities.length > 0;
  const missingScopedContent = Boolean(reference.scope) && !hasVisibleMapContent;
  return (
    <div
      ref={rootRef}
      className="map-reference-canvas"
      data-testid="map-preview-frame"
    >
      {visible && contentReady && missingScopedContent && (
        <p className="small text-muted p-3">This map's locations are unavailable.</p>
      )}
      {visible && contentReady && !missingScopedContent && staticPreview && (
        <StaticMapPreview
          reference={reference}
          markers={content.markers}
          entities={entities}
          connections={content.connections}
        />
      )}
      {visible && contentReady && !missingScopedContent && !staticPreview && (
        <MapCanvas
          places={[]}
          entities={entities}
          ownedMarkers={content.markers}
          ownedConnections={content.connections}
          focus={
            contentReady && hasVisibleMapContent
              ? null
              : { latitude: reference.latitude, longitude: reference.longitude }
          }
          pickedCoordinate={
            contentReady && hasVisibleMapContent
              ? null
              : { latitude: reference.latitude, longitude: reference.longitude }
          }
          initialFitPoints={contentReady ? fitPoints : []}
          initialFitDelayMs={0}
          showModernBorders={false}
          onEntitySelect={() => undefined}
          onMapError={onError}
        />
      )}
    </div>
  );
}

function parseHiddenProfileIds(value: string | null): string[] {
  if (!value) return [];
  const ids = value.split(",").map((id) => id.trim()).filter((id) => id && id.length <= 256);
  return ids.length <= 40 && new Set(ids).size === ids.length ? ids : [];
}


/**
 * A map reference can resolve to either an explicitly shared graph or public
 * nearby entities. Both sets must take part in the viewport calculation:
 * fitting only the saved centre leaves distant, valid markers outside an
 * embedded preview.
 */
export function embeddedMapFitPoints(
  reference: PublicMapReference,
  content: OwnedMapContent,
  entities: MapEntityLocation[],
) {
  const points = [
    ...content.markers.map((marker) => ({
      key: marker.key,
      latitude: marker.latitude,
      longitude: marker.longitude,
    })),
    ...entities.map((entity) => ({
      key: `ENTITY:${entity.entityType}:${entity.entityId}:${entity.locationRole}:${entity.placeId}`,
      latitude: entity.latitude,
      longitude: entity.longitude,
    })),
  ].filter(
    (point) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude),
  );

  return points.length
    ? points
    : [
        {
          key: "map-reference-focus",
          latitude: reference.latitude,
          longitude: reference.longitude,
        },
      ];
}

function isScopeType(value: string | null): value is SharedMapScope["type"] {
  return (
    value === "USER" ||
    value === "PROFILE" ||
    value === "CLUB" ||
    value === "EVENT" ||
    value === "SOURCE"
  );
}
