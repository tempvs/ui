import { Form } from "react-bootstrap";

export type HistoricalYearInput = { year: string; era: "BC" | "AD" };

type Props = {
  enabled: boolean;
  from: HistoricalYearInput;
  to: HistoricalYearInput;
  onEnabledChange: (enabled: boolean) => void;
  onFromChange: (value: HistoricalYearInput) => void;
  onToChange: (value: HistoricalYearInput) => void;
  label?: string;
  showToggle?: boolean;
  alwaysShowFields?: boolean;
  onValueEntered?: () => void;
};

/** Shared inclusive historical-range controls for filtering and editing. */
export default function HistoricalRangeFilter({
  enabled,
  from,
  to,
  onEnabledChange,
  onFromChange,
  onToChange,
  label = "Filter by years",
  showToggle = true,
  alwaysShowFields = false,
  onValueEntered,
}: Props) {
  const showFields = !showToggle || alwaysShowFields || enabled;
  return (
    <Form.Group className="mb-3">
      {showToggle ? (
        <Form.Check
          id="historical-range-enabled"
          label={label}
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
        />
      ) : (
        <Form.Label className="library-source-filter-heading">
          {label}
        </Form.Label>
      )}
      {showFields && (
        <div className="d-flex gap-2 mt-2">
          <YearControl
            label="From"
            value={from}
            onChange={onFromChange}
            onValueEntered={onValueEntered}
          />
          <YearControl
            label="To"
            value={to}
            onChange={onToChange}
            onValueEntered={onValueEntered}
          />
        </div>
      )}
    </Form.Group>
  );
}

function YearControl({
  label,
  value,
  onChange,
  onValueEntered,
}: {
  label: string;
  value: HistoricalYearInput;
  onChange: (value: HistoricalYearInput) => void;
  onValueEntered?: () => void;
}) {
  return (
    <div className="d-flex flex-column gap-1 flex-grow-1">
      <Form.Label className="small mb-0">{label}</Form.Label>
      <div className="d-flex gap-1">
        <Form.Control
          type="number"
          min="1"
          step="1"
          value={value.year}
          placeholder="Year"
          onChange={(event) => {
            onChange({
              ...value,
              year: event.target.value.replace(/[^0-9]/g, ""),
            });
            onValueEntered?.();
          }}
        />
        <Form.Select
          value={value.era}
          onChange={(event) => {
            onChange({ ...value, era: event.target.value as "BC" | "AD" });
            onValueEntered?.();
          }}
        >
          <option value="BC">BC</option>
          <option value="AD">AD</option>
        </Form.Select>
      </div>
    </div>
  );
}
