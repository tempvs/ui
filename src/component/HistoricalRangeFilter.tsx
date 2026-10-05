import { Form } from "react-bootstrap";
import { formatHistoricalYear } from "../util/historicalYear";

export type HistoricalYearInput = { year: string; era: "BC" | "AD" };

type Props = {
  enabled: boolean;
  from: HistoricalYearInput;
  to: HistoricalYearInput;
  onEnabledChange: (enabled: boolean) => void;
  onFromChange: (value: HistoricalYearInput) => void;
  onToChange: (value: HistoricalYearInput) => void;
  label?: string | null;
  showToggle?: boolean;
  alwaysShowFields?: boolean;
  onValueEntered?: () => void;
  onBlur?: () => void;
  compact?: boolean;
  className?: string;
  editable?: boolean;
  stacked?: boolean;
  inlineToggle?: boolean;
};

/** Shared inclusive historical-range controls for filtering and editing. */
export default function HistoricalRangeFilter({
  enabled,
  from,
  to,
  onEnabledChange,
  onFromChange,
  onToChange,
  label = "Years",
  showToggle = true,
  alwaysShowFields = false,
  onValueEntered,
  onBlur,
  compact = false,
  className = "",
  editable = true,
  stacked = false,
  inlineToggle = false,
}: Props) {
  const showFields = !showToggle || alwaysShowFields || enabled;
  const validRange = isValidHistoricalYear(from) && isValidHistoricalYear(to);
  const yearFields = (
    <div className={`${stacked ? "d-flex flex-column align-items-start gap-2" : "d-flex align-items-end gap-2"} ${compact ? "" : "mt-2"}`}>
      <HistoricalYearControl
        label={compact ? null : "From"}
        placeholder={compact ? "From" : "Year"}
        value={from}
        onChange={onFromChange}
        onValueEntered={onValueEntered}
        onBlur={validRange ? onBlur : undefined}
      />
      {!stacked && !compact && <span className="pb-2 text-muted" aria-hidden="true">–</span>}
      <HistoricalYearControl
        label={compact ? null : "To"}
        placeholder={compact ? "To" : "Year"}
        value={to}
        onChange={onToChange}
        onValueEntered={onValueEntered}
        onBlur={validRange ? onBlur : undefined}
      />
    </div>
  );
  return (
    <Form.Group className={`${compact ? "mb-0" : "mb-3"} ${className}`.trim()}>
      {showToggle && inlineToggle ? (
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Form.Check
            id="historical-range-enabled"
            label={label || "Years"}
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
            className="mb-0 text-nowrap"
          />
          {showFields && editable && yearFields}
          {showFields && !editable && <span>{formatHistoricalRange(
            from.year ? { year: Number(from.year), era: from.era } : null,
            to.year ? { year: Number(to.year), era: to.era } : null,
          )}</span>}
        </div>
      ) : showToggle ? (
        <Form.Check
          id="historical-range-enabled"
          label={label || "Years"}
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
        />
      ) : label ? (
        <Form.Label className="library-source-filter-heading">
          {label}
        </Form.Label>
      ) : null}
      {showFields && !editable && (
        <div className={compact ? "pb-2" : "mt-1"}>{formatHistoricalRange(
          from.year ? { year: Number(from.year), era: from.era } : null,
          to.year ? { year: Number(to.year), era: to.era } : null,
        )}</div>
      )}
      {showFields && editable && !inlineToggle && (
        <div className={`${stacked ? "d-flex flex-column align-items-start gap-2" : "d-flex align-items-end gap-2"} ${compact ? "" : "mt-2"}`}>
          <HistoricalYearControl
            label={compact ? null : "From"}
            value={from}
            onChange={onFromChange}
            onValueEntered={onValueEntered}
            onBlur={validRange ? onBlur : undefined}
          />
          {!stacked && <span className="pb-2 text-muted" aria-hidden="true">–</span>}
          <HistoricalYearControl
            label={compact ? null : "To"}
            value={to}
            onChange={onToChange}
            onValueEntered={onValueEntered}
            onBlur={validRange ? onBlur : undefined}
          />
        </div>
      )}
    </Form.Group>
  );
}

export function HistoricalYearControl({
  label,
  placeholder = "Year",
  value,
  onChange,
  onValueEntered,
  onBlur,
  readOnly = false,
  inputClassName = "",
  showEra = true,
  showEraLabel = false,
}: {
  label: string | null;
  placeholder?: string;
  value: HistoricalYearInput;
  onChange: (value: HistoricalYearInput) => void;
  onValueEntered?: () => void;
  onBlur?: () => void;
  readOnly?: boolean;
  inputClassName?: string;
  showEra?: boolean;
  showEraLabel?: boolean;
}) {
  return (
    <div className="d-flex flex-column gap-1">
      {label && <Form.Label className="small mb-0">{label}</Form.Label>}
      <div className="d-flex align-items-center gap-1">
        <Form.Control
          type="text"
          inputMode="numeric"
          value={value.year}
          placeholder={placeholder}
          maxLength={4}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          className={`${inputClassName} ${readOnly && !value.year ? "description-placeholder" : ""}`.trim()}
          isInvalid={value.year.length > 0 && !/^[1-9][0-9]*$/.test(value.year)}
          aria-label={label ? `${label} year` : "Year"}
          onChange={(event) => {
            onChange({
              ...value,
              year: event.target.value,
            });
            onValueEntered?.();
          }}
          onBlur={onBlur}
          style={{ minWidth: "4.25rem", width: "4.25rem" }}
        />
        {showEra ? (
          <Form.Check
            type="checkbox"
            label="BC"
            checked={value.era === "BC"}
            aria-label={`${label || "Year"} is BC`}
            onChange={(event) => {
              onChange({ ...value, era: event.target.checked ? "BC" : "AD" });
              onValueEntered?.();
            }}
            onBlur={onBlur}
            className="small text-nowrap"
          />
        ) : showEraLabel ? (
          <span className="historical-year-era" aria-label={`${value.era} era`}>
            {value.year && (value.era === "BC" || Number(value.year) < 100) ? value.era : ""}
          </span>
        ) : <span className="historical-year-era" aria-hidden="true" />}
      </div>
    </div>
  );
}

export function isValidHistoricalYear(value: HistoricalYearInput): boolean {
  return value.year === "" || /^[1-9][0-9]*$/.test(value.year);
}

export function formatHistoricalRange(
  from?: { year: number; era: "BC" | "AD" } | null,
  to?: { year: number; era: "BC" | "AD" } | null,
): string {
  const format = (value?: { year: number; era: "BC" | "AD" } | null) => formatHistoricalYear(value);
  if (!from && !to) return "—";
  return `${format(from)} – ${format(to)}`;
}
