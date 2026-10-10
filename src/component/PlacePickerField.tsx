import React, { useEffect, useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import { FaMapMarkerAlt, FaTimes } from "react-icons/fa";

import InlineSaveStatus from "./InlineSaveStatus";
import PlaceDetailsPanel from "./PlaceDetailsPanel";
import PlaceNamePopover from "./PlaceNamePopover";
import RelatedMapModal from "./RelatedMapModal";
import type { SaveStatus } from "./EditableFieldRow";
import { MapPlace, nearbyMapPlaces, searchMapPlaces } from "../map/mapApi";
import MapCanvas from "../map/MapCanvas";
import PlaceProposalModal from "../map/PlaceProposalModal";
import { matchingPlaceName } from "../map/placeNames";
import type { OwnedMapContent } from "../map/ownedMapContent";
import type { SharedMapScope } from "../map/sharedMapScope";

type PlacePickerFieldProps = {
  label: React.ReactNode;
  value?: Pick<MapPlace, "id" | "canonicalName"> | null;
  /** Existing legacy label displayed until an editor selects a canonical place. */
  readOnlyLabel?: string | null;
  editable: boolean;
  onChange: (place: MapPlace | null) => void;
  status?: SaveStatus;
  placeholder?: string;
  className?: string;
  labelWidth?: string;
  fieldMaxWidth?: string;
  /** Optional bounded relationship overlay for this page's location globe. */
  loadRelatedMapContent?: () => Promise<OwnedMapContent>;
  relatedMapScope?: SharedMapScope;
};

const MarkerIcon = FaMapMarkerAlt as React.ComponentType<{
  className?: string;
}>;
const ClearIcon = FaTimes as React.ComponentType<{ className?: string }>;

function isValidCoordinateInput({
  latitude,
  longitude,
}: {
  latitude: string;
  longitude: string;
}): boolean {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  return (
    latitude.trim() !== "" &&
    longitude.trim() !== "" &&
    Number.isFinite(parsedLatitude) &&
    Number.isFinite(parsedLongitude) &&
    parsedLatitude >= -90 &&
    parsedLatitude <= 90 &&
    parsedLongitude >= -180 &&
    parsedLongitude <= 180
  );
}

function hasCoordinateInput({
  latitude,
  longitude,
}: {
  latitude: string;
  longitude: string;
}): boolean {
  return latitude.trim() !== "" || longitude.trim() !== "";
}

/**
 * Shared canonical-place selector. It never accepts an arbitrary text label:
 * a selected value always comes from the public approved Map catalogue.
 */
export default function PlacePickerField({
  label,
  value = null,
  readOnlyLabel = null,
  editable,
  onChange,
  status = null,
  placeholder = "Choose a place",
  className = "mb-2",
  labelWidth = "7rem",
  fieldMaxWidth = "16rem",
  loadRelatedMapContent,
  relatedMapScope,
}: PlacePickerFieldProps) {
  const [show, setShow] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MapPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pinnedCoordinate, setPinnedCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [coordinateInput, setCoordinateInput] = useState({
    latitude: "",
    longitude: "",
  });
  const [showProposal, setShowProposal] = useState(false);
  const [showPinMap, setShowPinMap] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<MapPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  useEffect(() => {
    if (!show || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setFailed(false);
      searchMapPlaces(query, controller.signal)
        .then((places) =>
          setResults(
            places.map((place) => ({
              ...place,
              matchedName: matchingPlaceName(place, query),
            })),
          ),
        )
        .catch((error) => {
          if ((error as Error).name !== "AbortError") setFailed(true);
        })
        .finally(() => setLoading(false));
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, show]);

  useEffect(() => {
    if (!show) return;
    if (!isValidCoordinateInput(coordinateInput)) {
      setPinnedCoordinate(null);
      return;
    }
    setPinnedCoordinate({
      latitude: Number(coordinateInput.latitude),
      longitude: Number(coordinateInput.longitude),
    });
  }, [coordinateInput, show]);

  const coordinateInputIsInvalid =
    hasCoordinateInput(coordinateInput) &&
    !isValidCoordinateInput(coordinateInput);

  useEffect(() => {
    if (!show || !pinnedCoordinate) {
      setNearbyPlaces([]);
      setNearbyLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setNearbyLoading(true);
    void nearbyMapPlaces(
      pinnedCoordinate.latitude,
      pinnedCoordinate.longitude,
      25,
      controller.signal,
    )
      .then(setNearbyPlaces)
      .catch(() => {
        if (!controller.signal.aborted) setNearbyPlaces([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setNearbyLoading(false);
      });
    return () => controller.abort();
  }, [pinnedCoordinate, show]);

  const select = (place: MapPlace) => {
    onChange({
      ...place,
      matchedName: place.matchedName || matchingPlaceName(place, query),
    });
    setShow(false);
    setQuery("");
    setPinnedCoordinate(null);
    setCoordinateInput({ latitude: "", longitude: "" });
  };

  return (
    <>
      <div className={`d-flex align-items-center gap-3 ${className}`.trim()}>
        <div
          className="inline-editable-row-label text-start small fw-semibold"
          style={{ width: labelWidth }}
        >
          {label}
        </div>
        <div
          className="small d-flex align-items-center gap-1"
          style={{ width: "100%", maxWidth: fieldMaxWidth }}
        >
          <div
            className="inline-editable-control inline-editable-readonly"
            style={{ minWidth: 0 }}
          >
            {editable ? (
              <button
                type="button"
                className="inline-editable-input inline-editable-readonly-input text-start w-100"
                onClick={() => {
                  setPinnedCoordinate(null);
                  setCoordinateInput({ latitude: "", longitude: "" });
                  setShowPinMap(false);
                  setShow(true);
                }}
              >
                {value?.canonicalName || readOnlyLabel || placeholder}
              </button>
            ) : value?.id ? (
              <span className="d-inline-flex align-items-baseline">
                <PlaceNamePopover
                  placeId={value.id}
                  displayName={value.canonicalName}
                />
                <RelatedMapModal
                  placeId={value.id}
                  displayName={value.canonicalName}
                  loadRelatedMapContent={loadRelatedMapContent}
                  scope={relatedMapScope}
                />
              </span>
            ) : (
              <div className="small text-start px-1 py-1">
                {readOnlyLabel || "-"}
              </div>
            )}
            {editable && (
              <span className="inline-editable-glyph" aria-hidden="true">
                <MarkerIcon />
              </span>
            )}
            {status && (
              <span className="inline-editable-status">
                <InlineSaveStatus
                  status={status}
                  savingTitle="Saving"
                  errorTitle="Save failed"
                />
              </span>
            )}
          </div>
          {editable && value?.id && (
            <RelatedMapModal
              placeId={value.id}
              displayName={value.canonicalName}
              loadRelatedMapContent={loadRelatedMapContent}
              scope={relatedMapScope}
            />
          )}
        </div>
      </div>
      <Modal
        show={show}
        onHide={() => {
          setShow(false);
          setPinnedCoordinate(null);
          setCoordinateInput({ latitude: "", longitude: "" });
          setShowPinMap(false);
        }}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Select a place</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {value?.id && !showPinMap && (
            <div className="mb-4">
              <PlaceDetailsPanel
                placeId={value.id}
                displayName={value.canonicalName}
              />
            </div>
          )}
          <Form.Control
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search approved places"
            aria-label="Search approved places"
          />
          <div className="mt-3 place-picker-results">
            {query.trim().length < 2 && (
              <p className="small text-muted mb-0">
                Enter at least two characters.
              </p>
            )}
            {loading && (
              <div className="text-center py-2">
                <Spinner animation="border" size="sm" />
              </div>
            )}
            {failed && (
              <p className="small text-danger mb-0">
                Unable to search places right now.
              </p>
            )}
            {!loading &&
              !failed &&
              query.trim().length >= 2 &&
              results.length === 0 && (
                <p className="small text-muted mb-0">
                  No approved places match this search.
                </p>
              )}
            {!loading &&
              results.map((place) => (
                <Button
                  key={place.id}
                  variant="light"
                  className="w-100 text-start mb-1"
                  onClick={() => select(place)}
                >
                  <strong>{place.matchedName || place.canonicalName}</strong>
                  {place.matchedName &&
                    place.matchedName !== place.canonicalName && (
                      <span className="text-muted">
                        {" "}
                        ({place.canonicalName})
                      </span>
                    )}
                  <span className="ms-2 small text-muted">
                    {place.featureType}
                  </span>
                </Button>
              ))}
          </div>
          {value?.id && !showPinMap && (
            <Button
              type="button"
              size="sm"
              variant="link"
              className="px-0 mt-3"
              onClick={() => setShowPinMap(true)}
            >
              Propose a different place on the map
            </Button>
          )}
          {(!value?.id || showPinMap) && (
            <div className="place-picker-drop-map mt-3">
              <p className="small text-muted mb-2">
                Or click the map to pin a shared place proposal. Proposed points
                remain unavailable for selection until a geography editor
                reviews them.
              </p>
              <MapCanvas
                places={[]}
                entities={[]}
                pickedCoordinate={pinnedCoordinate}
                showModernBorders={false}
                onEntitySelect={() => undefined}
                onCoordinatePick={(coordinate) => {
                  setCoordinateInput({
                    latitude: String(coordinate.latitude),
                    longitude: String(coordinate.longitude),
                  });
                }}
                onMapError={() => undefined}
              />
              <div className="d-flex gap-2 mt-2">
                <Form.Control
                  aria-label="Pinned latitude"
                  aria-describedby={
                    coordinateInputIsInvalid
                      ? "pinned-coordinate-feedback"
                      : undefined
                  }
                  inputMode="decimal"
                  placeholder="Latitude"
                  isInvalid={coordinateInputIsInvalid}
                  value={coordinateInput.latitude}
                  onChange={(event) =>
                    setCoordinateInput((current) => ({
                      ...current,
                      latitude: event.target.value,
                    }))
                  }
                />
                <Form.Control
                  aria-label="Pinned longitude"
                  aria-describedby={
                    coordinateInputIsInvalid
                      ? "pinned-coordinate-feedback"
                      : undefined
                  }
                  inputMode="decimal"
                  placeholder="Longitude"
                  isInvalid={coordinateInputIsInvalid}
                  value={coordinateInput.longitude}
                  onChange={(event) =>
                    setCoordinateInput((current) => ({
                      ...current,
                      longitude: event.target.value,
                    }))
                  }
                />
              </div>
              {coordinateInputIsInvalid && (
                <p
                  id="pinned-coordinate-feedback"
                  className="small text-danger mb-0 mt-1"
                  role="alert"
                >
                  Enter both coordinates: latitude from -90 to 90 and longitude
                  from -180 to 180.
                </p>
              )}
              <div className="d-flex align-items-center gap-2 mt-2">
                <span className="small text-muted" aria-live="polite">
                  {pinnedCoordinate
                    ? `${pinnedCoordinate.latitude.toFixed(5)}, ${pinnedCoordinate.longitude.toFixed(5)}`
                    : "No point pinned"}
                </span>
                {hasCoordinateInput(coordinateInput) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="link"
                    className="p-0"
                    onClick={() => {
                      setPinnedCoordinate(null);
                      setCoordinateInput({ latitude: "", longitude: "" });
                    }}
                  >
                    Clear point
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline-dark"
                  disabled={!pinnedCoordinate}
                  onClick={() => {
                    setShow(false);
                    setShowProposal(true);
                  }}
                >
                  Propose pinned place
                </Button>
              </div>
              {nearbyLoading && (
                <div className="small text-muted mt-2" aria-live="polite">
                  Checking nearby approved places…
                </div>
              )}
              {!nearbyLoading && nearbyPlaces.length > 0 && (
                <div className="mt-2">
                  <p className="small text-muted mb-1">
                    Nearby approved places — select one if it is the right
                    place:
                  </p>
                  <div className="place-picker-nearby-results">
                    {nearbyPlaces.map((place) => (
                      <Button
                        key={place.id}
                        type="button"
                        variant="light"
                        size="sm"
                        className="text-start"
                        onClick={() => select(place)}
                      >
                        <strong>{place.canonicalName}</strong>
                        <span className="ms-2 text-muted">
                          {place.featureType}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        {editable && value && (
          <Modal.Footer className="justify-content-between">
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => {
                onChange(null);
                setShow(false);
                setPinnedCoordinate(null);
                setCoordinateInput({ latitude: "", longitude: "" });
                setShowPinMap(false);
              }}
            >
              <ClearIcon className="me-1" />
              Clear location
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShow(false);
                setPinnedCoordinate(null);
                setCoordinateInput({ latitude: "", longitude: "" });
                setShowPinMap(false);
              }}
            >
              Done
            </Button>
          </Modal.Footer>
        )}
      </Modal>
      <PlaceProposalModal
        show={showProposal}
        initialLatitude={
          pinnedCoordinate ? String(pinnedCoordinate.latitude) : ""
        }
        initialLongitude={
          pinnedCoordinate ? String(pinnedCoordinate.longitude) : ""
        }
        onHide={() => {
          setShowProposal(false);
          setPinnedCoordinate(null);
          setCoordinateInput({ latitude: "", longitude: "" });
        }}
      />
    </>
  );
}
