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
  const validRange = isValidHistoricalRange(from, to);
  const rangeOrderInvalid = !isChronologicalHistoricalRange(from, to);
  const yearFields = (
    <div className={`${stacked ? "d-flex flex-column align-items-start gap-2" : "d-flex align-items-end gap-2"} ${compact ? "" : "mt-2"}`}>
      <HistoricalYearControl
        label={compact ? null : "From"}
        placeholder={compact ? "From" : "Year"}
        value={from}
        onChange={onFromChange}
        onValueEntered={onValueEntered}
        onBlur={validRange ? onBlur : undefined}
        isInvalid={rangeOrderInvalid}
        inputClassName="historical-year-from"
      />
      {!stacked && !compact && <span className="pb-2 text-muted" aria-hidden="true">–</span>}
      <HistoricalYearControl
        label={compact ? null : "To"}
        placeholder={compact ? "To" : "Year"}
        value={to}
        onChange={onToChange}
        onValueEntered={onValueEntered}
        onBlur={validRange ? onBlur : undefined}
        isInvalid={rangeOrderInvalid}
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
            isInvalid={rangeOrderInvalid}
            inputClassName="historical-year-from"
          />
          {!stacked && <span className="pb-2 text-muted" aria-hidden="true">–</span>}
          <HistoricalYearControl
            label={compact ? null : "To"}
            value={to}
            onChange={onToChange}
            onValueEntered={onValueEntered}
            onBlur={validRange ? onBlur : undefined}
            isInvalid={rangeOrderInvalid}
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
  isInvalid = false,
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
  isInvalid?: boolean;
}) {
  return (
    <div className="d-flex flex-column gap-1">
      {label && <Form.Label className="small mb-0">{label}</Form.Label>}
      <div className="d-flex align-items-center gap-1">
        <Form.Control
          type="text"
          size="sm"
          inputMode="numeric"
          value={value.year}
          placeholder={placeholder}
          maxLength={4}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          className={`${inputClassName} ${readOnly && !value.year ? "description-placeholder" : ""}`.trim()}
          isInvalid={isInvalid || (value.year.length > 0 && !/^[1-9][0-9]*$/.test(value.year))}
          aria-label={label ? `${label} year` : "Year"}
          onChange={(event) => {
            onChange({
              ...value,
              year: event.target.value,
            });
            onValueEntered?.();
          }}
          onBlur={onBlur}
          // Four visible numeric characters is intentional: values are
          // validated and persisted as positive four-digit-or-shorter years.
          style={{ minWidth: "2.75rem", width: "2.75rem" }}
        />
        {showEra ? (
          <button
            type="button"
            className="historical-year-era-toggle"
            aria-label={`${label || "Year"} era: ${value.era}. Activate to change to ${value.era === "BC" ? "AD" : "BC"}.`}
            aria-pressed={value.era === "BC"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange({ ...value, era: value.era === "BC" ? "AD" : "BC" });
              onValueEntered?.();
            }}
          >
            {value.era}
          </button>
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

/** Open-ended ranges are valid; supplied endpoints must be chronological. */
export function isChronologicalHistoricalRange(
  from: HistoricalYearInput,
  to: HistoricalYearInput,
): boolean {
  if (!from.year || !to.year) return true;
  if (!isValidHistoricalYear(from) || !isValidHistoricalYear(to)) return false;
  const ordinal = (value: HistoricalYearInput) =>
    value.era === "BC" ? 1 - Number(value.year) : Number(value.year);
  return ordinal(from) <= ordinal(to);
}

export function isValidHistoricalRange(
  from: HistoricalYearInput,
  to: HistoricalYearInput,
): boolean {
  return isValidHistoricalYear(from)
    && isValidHistoricalYear(to)
    && isChronologicalHistoricalRange(from, to);
}

export function formatHistoricalRange(
  from?: { year: number; era: "BC" | "AD" } | null,
  to?: { year: number; era: "BC" | "AD" } | null,
): string {
  const format = (value?: { year: number; era: "BC" | "AD" } | null) => formatHistoricalYear(value);
  if (!from && !to) return "—";
  return `${format(from)} – ${format(to)}`;
}
