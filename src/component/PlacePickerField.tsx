import React, { useEffect, useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import { FaMapMarkerAlt, FaTimes } from "react-icons/fa";

import InlineSaveStatus from "./InlineSaveStatus";
import type { SaveStatus } from "./EditableFieldRow";
import { MapPlace, searchMapPlaces } from "../map/mapApi";

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
};

const MarkerIcon = FaMapMarkerAlt as React.ComponentType<{
  className?: string;
}>;
const ClearIcon = FaTimes as React.ComponentType<{ className?: string }>;

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
}: PlacePickerFieldProps) {
  const [show, setShow] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MapPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

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
        .then(setResults)
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

  const select = (place: MapPlace) => {
    onChange(place);
    setShow(false);
    setQuery("");
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
          className="small"
          style={{ width: "100%", maxWidth: fieldMaxWidth }}
        >
          <div className="inline-editable-control inline-editable-readonly">
            {editable ? (
              <button
                type="button"
                className="inline-editable-input inline-editable-readonly-input text-start w-100"
                onClick={() => setShow(true)}
              >
                {value?.canonicalName || readOnlyLabel || placeholder}
              </button>
            ) : (
              <div className="small text-start px-1 py-1">
                {value?.canonicalName || readOnlyLabel || "-"}
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
        </div>
      </div>
      <Modal show={show} onHide={() => setShow(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Select a place</Modal.Title>
        </Modal.Header>
        <Modal.Body>
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
                  <strong>{place.canonicalName}</strong>
                  <span className="ms-2 small text-muted">
                    {place.featureType}
                  </span>
                </Button>
              ))}
          </div>
        </Modal.Body>
        {editable && value && (
          <Modal.Footer className="justify-content-between">
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => {
                onChange(null);
                setShow(false);
              }}
            >
              <ClearIcon className="me-1" />
              Clear location
            </Button>
            <Button variant="secondary" onClick={() => setShow(false)}>
              Done
            </Button>
          </Modal.Footer>
        )}
      </Modal>
    </>
  );
}
