import { Form } from "react-bootstrap";

export type HistoricalYearInput = { year: string; era: "BC" | "AD" };

type Props = {
  enabled: boolean;
  from: HistoricalYearInput;
  to: HistoricalYearInput;
  onEnabledChange: (enabled: boolean) => void;
  onFromChange: (value: HistoricalYearInput) => void;
  onToChange: (value: HistoricalYearInput) => void;
};

/** Shared inclusive historical-range search filter. */
export default function HistoricalRangeFilter({
  enabled,
  from,
  to,
  onEnabledChange,
  onFromChange,
  onToChange,
}: Props) {
  return (
    <Form.Group className="mb-3">
      <Form.Check
        id="historical-range-enabled"
        label="Filter by years"
        checked={enabled}
        onChange={(event) => onEnabledChange(event.target.checked)}
      />
      {enabled && (
        <div className="d-flex gap-2 mt-2">
          <YearControl label="From" value={from} onChange={onFromChange} />
          <YearControl label="To" value={to} onChange={onToChange} />
        </div>
      )}
    </Form.Group>
  );
}

function YearControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HistoricalYearInput;
  onChange: (value: HistoricalYearInput) => void;
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
          onChange={(event) =>
            onChange({
              ...value,
              year: event.target.value.replace(/[^0-9]/g, ""),
            })
          }
        />
        <Form.Select
          value={value.era}
          onChange={(event) =>
            onChange({ ...value, era: event.target.value as "BC" | "AD" })
          }
        >
          <option value="BC">BC</option>
          <option value="AD">AD</option>
        </Form.Select>
      </div>
    </div>
  );
}
