import { useEffect, useRef, useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { FaGlobeAmericas } from "react-icons/fa";
import {
  FaFloppyDisk as FloppyDiskIcon,
  FaLink as LinkIcon,
  FaPaperPlane as PaperPlaneIcon,
} from "react-icons/fa6";
import { useNavigate } from "react-router-dom";

import Spinner from "./Spinner";
import MapCanvas from "../map/LazyMapCanvas";
import type { OwnedMapContent } from "../map/ownedMapContent";
import {
  appendSharedMapScope,
  type SharedMapScope,
} from "../map/sharedMapScope";
import {
  getMapPlace,
  saveMapSnapshot,
  type MapEntityLocation,
  type MapPlace,
} from "../map/mapApi";
import type { PublicMapReference } from "../map/MapReferenceAttachment";
import { stageMapAttachment } from "../map/pendingMapAttachment";
import { getViewer } from "../auth/viewerApi";
import {
  fetchClubProfiles,
  getUserProfileByUserId,
} from "../profile/profileApi";
import ProfileSearchPicker from "../profile/components/ProfileSearchPicker";
import type { Profile } from "../profile/profileTypes";
import { getProfileClubs, type Club } from "../club/clubApi";

type RelatedMapModalProps = {
  placeId: string;
  displayName: string;
  /** A compact default comparison area. The full map can widen it later. */
  radiusKm?: number;
  /** Page-scoped relation data (for example a profile's public clubs/sources).
   * This intentionally never becomes part of the public nearby-map endpoint. */
  loadRelatedMapContent?: () => Promise<OwnedMapContent>;
  /** Makes the full-map URL reproduce this public page's relationship slice. */
  scope?: SharedMapScope;
};

const GlobeIcon = FaGlobeAmericas as React.ComponentType<{
  className?: string;
}>;
const LinkIconButton = LinkIcon as React.ComponentType<{
  "aria-hidden"?: boolean;
}>;
const FloppyDiskIconButton = FloppyDiskIcon as React.ComponentType<{
  "aria-hidden"?: boolean;
}>;
const PaperPlaneIconButton = PaperPlaneIcon as React.ComponentType<{
  "aria-hidden"?: boolean;
}>;
const allEntityTypes: MapEntityLocation["entityType"][] = [
  "PROFILE",
  "CLUB",
  "EVENT",
  "SOURCE",
];

/**
 * Shared entry point from location fields. A place remains the focus, while
 * the compact public Map projection supplies nearby profiles, clubs, events,
 * and sources without each entity page inventing a different map widget.
 */
export default function RelatedMapModal({
  placeId,
  displayName,
  radiusKm = 25,
  loadRelatedMapContent,
  scope,
}: RelatedMapModalProps) {
  const [show, setShow] = useState(false);
  const showRef = useRef(show);
  showRef.current = show;
  const [mapModalReady, setMapModalReady] = useState(false);
  const [relatedContentReady, setRelatedContentReady] = useState(
    () => !loadRelatedMapContent,
  );
  const [place, setPlace] = useState<MapPlace | null | undefined>(undefined);
  const [relatedContent, setRelatedContent] = useState<OwnedMapContent>({
    markers: [],
    connections: [],
  });
  const [error, setError] = useState("");
  const [snapshotStatus, setSnapshotStatus] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [shareDestination, setShareDestination] = useState<
    "chat" | "profile" | "club"
  >("chat");
  const [shareProfiles, setShareProfiles] = useState<Profile[]>([]);
  const [shareClubs, setShareClubs] = useState<Club[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saveTitle, setSaveTitle] = useState(displayName);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  const mapPath = place
    ? `/map?${appendSharedMapScope(
        fullMapParameters(place, displayName, radiusKm),
        scope,
      ).toString()}`
    : "";
  const mapReference = place
    ? {
        placeId: place.id,
        placeName: displayName,
        latitude: place.latitude,
        longitude: place.longitude,
        radiusKm,
        entityTypes: allEntityTypes,
        ...(scope ? { scope } : {}),
      }
    : null;

  const saveCurrentMap = async (
    requestedTitle: string,
  ): Promise<PublicMapReference | null> => {
    if (!mapReference) return null;
    const title = requestedTitle;
    if (!title?.trim()) return null;
    try {
      await saveMapSnapshot({
        title: title.trim(),
        reference: mapReference,
        ...(scope?.type === "PROFILE" ? { profileId: scope.id } : {}),
        ...(scope
          ? {
              scope: {
                type: scope.type === "USER" ? "PERSONAL" : scope.type,
                ...(scope.type === "USER" ? {} : { id: scope.id }),
              },
            }
          : {}),
      });
      setSnapshotStatus("Saved to your maps.");
      return mapReference;
    } catch (caught) {
      setSnapshotStatus(
        (caught as Error).message || "Unable to save this map.",
      );
      return null;
    }
  };

  const sendTo = (
    pathname: string,
    target?: { type: "PROFILE" | "CLUB"; id: string },
  ) => {
    if (!mapReference) return;
    stageMapAttachment(mapReference, undefined, target);
    setShowShare(false);
    setShow(false);
    window.setTimeout(
      () => navigate(pathname, { state: target ? { mapAttachment: mapReference, mapTarget: target } : { composeMap: true } }),
      0,
    );
  };

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!showShare || !authenticated) return;
    let active = true;
    setShareLoading(true);
    void Promise.all([
      getViewer(),
    ])
      .then(async ([viewer]) => {
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
        const profiles = [
          ...(personal ? [personal] : []),
          ...clubProfiles,
        ];
        setShareProfiles(profiles);
        if (shareDestination !== "club") return;
        const groups = await Promise.all(
          profiles.map((profile) => getProfileClubs(profile.id).catch(() => [])),
        );
        if (active)
          setShareClubs(
            Array.from(
              new Map(
                groups.flat().map((club) => [String(club.id), club]),
              ).values(),
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

  useEffect(() => {
    if (!show) return undefined;
    const controller = new AbortController();
    setPlace(undefined);
    setRelatedContent({ markers: [], connections: [] });
    setError("");
    void getMapPlace(placeId, controller.signal)
      .then((nextPlace) => {
        if (!nextPlace) {
          setPlace(null);
          return;
        }
        setPlace(nextPlace);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError((caught as Error).message || "Unable to load related map.");
      });
    return () => controller.abort();
  }, [placeId, show]);

  useEffect(() => {
    if (!show) return undefined;
    if (!loadRelatedMapContent) {
      setRelatedContentReady(true);
      return undefined;
    }
    let active = true;
    setRelatedContentReady(false);
    void loadRelatedMapContent()
      .then((content) => {
        if (active) setRelatedContent(content);
      })
      // Relationship data is optional; keep the focused place usable if it
      // cannot be read.
      .catch(() => undefined)
      .finally(() => {
        if (active) setRelatedContentReady(true);
      });
    return () => {
      active = false;
    };
  }, [loadRelatedMapContent, show]);

  const visibleRelatedContent = relatedContent;
  const fitPoints = [
    ...(place
      ? [
          {
            key: `PLACE:${place.id}`,
            latitude: place.latitude,
            longitude: place.longitude,
          },
        ]
      : []),
    ...visibleRelatedContent.markers,
  ];
  // An avatar marker already identifies the focused resource. Drawing the
  // selected-place label beneath it duplicates the label and obscures the
  // thumbnail, especially for a one-point club map.
  const hasRelatedThumbnail = visibleRelatedContent.markers.some(
    (marker) => Boolean(marker.thumbnailUrl),
  );

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="related-map-trigger p-0 ms-1 align-baseline"
        aria-label={`Open related map for ${displayName}`}
        title="Open related map"
        onClick={() => setShow(true)}
      >
        <GlobeIcon />
      </Button>
      <Modal
        show={show}
        onHide={() => setShow(false)}
        onEnter={() => setMapModalReady(false)}
        onEntered={() => setMapModalReady(true)}
        // Bootstrap can finish a previous close transition after the user has
        // already reopened the modal. Do not let that old callback turn the
        // new map back into a permanent loading spinner.
        onExited={() => {
          if (!showRef.current) setMapModalReady(false);
        }}
        centered
        size="xl"
        dialogClassName="related-map-modal-dialog"
      >
        <Modal.Header closeButton>
          <Modal.Title>Related map: {displayName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {place === undefined && !error && (
            <div className="py-4 text-center">
              <Spinner size="sm" />
            </div>
          )}
          {error && <Alert variant="warning">{error}</Alert>}
          {relatedContent.truncated && <Alert variant="warning">This map shows a limited part of the collection.</Alert>}
          {place === null && !error && (
            <Alert variant="warning">This place is no longer available.</Alert>
          )}
          {place && (
            <>
              <p className="small text-muted">
                {visibleRelatedContent.markers.length
                  ? `${visibleRelatedContent.markers.length === 1 ? "This related item is" : `${visibleRelatedContent.markers.length} related items are`} shown with connection lines.`
                  : "Only this page's related content is shown."}
              </p>
              <div className="related-map-canvas">
                {(!mapModalReady || !relatedContentReady) && (
                  <div className="py-4 text-center">
                    <Spinner size="sm" />
                  </div>
                )}
                {show && mapModalReady && relatedContentReady && (
                <MapCanvas
                  places={[{ ...place, matchedName: displayName }]}
                  entities={[]}
                  ownedMarkers={visibleRelatedContent.markers}
                  ownedConnections={visibleRelatedContent.connections}
                  focus={visibleRelatedContent.markers.length ? null : place}
                  initialFitPoints={fitPoints}
                  selectedPlaceId={hasRelatedThumbnail ? null : place.id}
                  showModernBorders={false}
                  onEntitySelect={() => undefined}
                  onOwnedMarkerSelect={(marker) => navigate(marker.path)}
                  onMapError={setError}
                />
                )}
              </div>
              {snapshotStatus && (
                <p className="small text-muted mt-2 mb-0">{snapshotStatus}</p>
              )}
            </>
          )}
        </Modal.Body>
        {place && (
          <Modal.Footer className="related-map-modal-footer">
            <Button
              variant="outline-dark"
              title="Open in Map"
              aria-label="Open in Map"
              onClick={() => {
                setShow(false);
                navigate(mapPath);
              }}
            >
              <GlobeIcon />
            </Button>
            <Button
              variant="outline-dark"
              title="Copy public map link"
              aria-label="Copy public map link"
              onClick={() => {
                // Keep the public page/user scope. Without it, the recipient
                // would see their own personal map rather than the graph the
                // sender had open.
                void navigator.clipboard
                  ?.writeText(`${window.location.origin}${mapPath}`)
                  .catch(() => undefined);
              }}
            >
              <LinkIconButton aria-hidden />
            </Button>
            {authenticated && (
              <Button
                variant="outline-dark"
                title="Save map"
                aria-label="Save map"
                onClick={() => {
                  setSaveTitle(displayName);
                  setShowSave(true);
                }}
              >
                <FloppyDiskIconButton aria-hidden />
              </Button>
            )}
            {authenticated && (
              <Button
                variant="outline-dark"
                title="Send map"
                aria-label="Send map"
                onClick={() => {
                  setShow(false);
                  setShareDestination("chat");
                  setShowShare(true);
                }}
              >
                <PaperPlaneIconButton aria-hidden />
              </Button>
            )}
          </Modal.Footer>
        )}
      </Modal>
      <Modal show={showSave} onHide={() => setShowSave(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Save map</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label htmlFor={`related-map-save-title-${placeId}`}>
              Saved map name
            </Form.Label>
            <Form.Control
              id={`related-map-save-title-${placeId}`}
              value={saveTitle}
              maxLength={200}
              autoFocus
              onChange={(event) => setSaveTitle(event.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setShowSave(false)}
          >
            Cancel
          </Button>
          <Button
            variant="dark"
            onClick={() => {
              void saveCurrentMap(saveTitle).then((reference) => {
                if (!reference) return;
                setShowSave(false);
                setShow(false);
              });
            }}
          >
            Save map
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal show={showShare} onHide={() => setShowShare(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Send this map</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Choose where to post this map. It is attached immediately; saving a
            separate map snapshot is optional.
          </p>
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

function fullMapParameters(
  place: MapPlace,
  displayName: string,
  radius: number,
): URLSearchParams {
  return new URLSearchParams({
    placeId: place.id,
    q: displayName,
    lat: String(place.latitude),
    lng: String(place.longitude),
    radiusKm: String(radius),
  });
}
