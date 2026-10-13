import React, { useEffect, useId, useState } from "react";
import { Form } from "react-bootstrap";

import type { MapPlace } from "../map/mapApi";

type PlaceSearchAutocompleteProps = {
  query: string;
  onQueryChange: (value: string) => void;
  results: MapPlace[] | null;
  loading: boolean;
  failed: boolean;
  onSelect: (place: MapPlace) => void;
  placeholder: string;
  ariaLabel: string;
  inputId?: string;
  autoFocus?: boolean;
  inputClassName?: string;
  resultsClassName?: string;
  optionClassName?: string;
  statusClassName?: string;
};

/**
 * One accessible approved-place autocomplete for the full Map and all
 * entity-location pickers. Results remain ordinary buttons (so they work
 * without special screen-reader support), while the combobox semantics and
 * arrow/Enter handling make quick keyboard selection predictable everywhere.
 */
export default function PlaceSearchAutocomplete({
  query,
  onQueryChange,
  results,
  loading,
  failed,
  onSelect,
  placeholder,
  ariaLabel,
  inputId,
  autoFocus = false,
  inputClassName,
  resultsClassName = "place-picker-results",
  optionClassName = "w-100 text-start mb-1",
  statusClassName = "small text-muted mb-0",
}: PlaceSearchAutocompleteProps) {
  const generatedId = useId().replace(/:/g, "");
  const listboxId = `${inputId || generatedId}-results`;
  const [activeIndex, setActiveIndex] = useState(-1);
  const visibleResults = results ?? [];

  useEffect(() => setActiveIndex(-1), [query, results]);

  const choose = (place: MapPlace) => {
    setActiveIndex(-1);
    onSelect(place);
  };

  return (
    <>
      <Form.Control
        id={inputId}
        autoFocus={autoFocus}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        autoComplete="off"
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={Boolean(results && query.trim().length >= 2)}
        aria-controls={listboxId}
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        className={inputClassName}
        onKeyDown={(event) => {
          if (!visibleResults.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) =>
              current >= visibleResults.length - 1 ? 0 : current + 1,
            );
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) =>
              current <= 0 ? visibleResults.length - 1 : current - 1,
            );
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            const place = visibleResults[activeIndex];
            if (place) choose(place);
          } else if (event.key === "Escape") {
            setActiveIndex(-1);
          }
        }}
      />
      {loading && (
        <p className={statusClassName} role="status">
          Searching…
        </p>
      )}
      {failed && (
        <p className={`${statusClassName} text-danger`} role="alert">
          Unable to search places right now.
        </p>
      )}
      {!loading && results && (
        <div id={listboxId} className={resultsClassName} role="listbox" aria-label="Matching places">
          {visibleResults.length === 0 ? (
            <p className="small text-muted mb-0 px-2 py-1">
              No approved places match this search.
            </p>
          ) : (
            visibleResults.map((place, index) => (
              <button
                type="button"
                key={place.id}
                id={`${listboxId}-option-${index}`}
                className={optionClassName}
                role="option"
                aria-selected={activeIndex === index}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(place)}
              >
                <strong>{place.matchedName || place.canonicalName}</strong>
                {place.matchedName && place.matchedName !== place.canonicalName && (
                  <span className="text-muted"> ({place.canonicalName})</span>
                )}
                <span className="text-muted ms-2 small">{place.featureType}</span>
              </button>
            ))
          )}
        </div>
      )}
    </>
  );
}
