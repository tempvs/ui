import React, { useEffect, useMemo, useState } from "react";
import { Form } from "react-bootstrap";

import { EVENT_TIME_ZONES } from "./timeZones";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
};

/** A small type-ahead timezone picker. Only a compact matching list is shown. */
export default function TimeZonePicker({
  value,
  onChange,
  onCommit,
  disabled = false,
  ariaLabel = "Time zone",
}: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => setQuery(value), [value]);

  const options = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const matching = EVENT_TIME_ZONES.filter((zone) =>
      zone.toLocaleLowerCase().includes(normalized),
    );
    return matching.slice(0, 8);
  }, [query]);

  const select = (zone: string) => {
    setQuery(zone);
    setOpen(false);
    onChange(zone);
    onCommit?.();
  };

  return (
    <div className="event-time-zone-picker">
      <Form.Control
        size="sm"
        aria-label={ariaLabel}
        value={query}
        disabled={disabled}
        placeholder="Search time zones"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open && options.length > 0 && (
        <div
          className="event-time-zone-options"
          role="listbox"
          aria-label="Matching time zones"
        >
          {options.map((zone) => (
            <button
              type="button"
              role="option"
              aria-selected={zone === value}
              key={zone}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(zone)}
            >
              {zone}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
