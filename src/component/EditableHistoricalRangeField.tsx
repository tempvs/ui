import React from "react";

import EditableFieldRow, { type SaveStatus } from "./EditableFieldRow";
import {
  HistoricalYearControl,
  formatHistoricalRange,
  isChronologicalHistoricalRange,
  isValidHistoricalRange,
  type HistoricalYearInput,
} from "./HistoricalRangeFilter";

type Props = {
  /** Omit the label when the range is paired with another field on one row. */
  label?: React.ReactNode;
  editable: boolean;
  from: HistoricalYearInput;
  to: HistoricalYearInput;
  onFromChange: (value: HistoricalYearInput) => void;
  onToChange: (value: HistoricalYearInput) => void;
  onBlur: () => void;
  status?: SaveStatus;
  className?: string;
  fieldMaxWidth?: string;
  labelWidth?: string;
};

/**
 * A paired field implemented through EditableFieldRow. Read-only mode uses
 * one compact chronological string; edit mode exposes the two endpoints and
 * their era toggles.
 */
export default function EditableHistoricalRangeField({
  label,
  editable,
  from,
  to,
  onFromChange,
  onToChange,
  onBlur,
  status = null,
  className = "mb-2",
  fieldMaxWidth = "13rem",
  labelWidth,
}: Props) {
  const rangeOrderInvalid = !isChronologicalHistoricalRange(from, to);
  const canSaveRange = isValidHistoricalRange(from, to);
  const displayValue = formatHistoricalRange(
    from.year ? { year: Number(from.year), era: from.era } : null,
    to.year ? { year: Number(to.year), era: to.era } : null,
  );
  return (
    <EditableFieldRow
      label={label}
      editable={editable}
      status={status}
      className={className}
      fieldMaxWidth={fieldMaxWidth}
      labelWidth={labelWidth}
      readOnlyValue={displayValue}
      renderControl={({ editing, onBlur: finishEditing }) => (
        !editing ? (
          <span className="historical-range-readonly-value">{displayValue}</span>
        ) : <div className="historical-range-inline-control d-flex align-items-center gap-1">
          <HistoricalYearControl
            label={null}
            placeholder="From"
            value={from}
            readOnly={!editing}
            showEra={editing}
            showEraLabel={!editing}
            inputClassName="inline-editable-input historical-year-from"
            onChange={onFromChange}
            onBlur={() => finishEditing(() => {
              if (canSaveRange) onBlur();
            })}
            isInvalid={rangeOrderInvalid}
          />
          <span className="text-muted" aria-hidden="true">–</span>
          <HistoricalYearControl
            label={null}
            placeholder="To"
            value={to}
            readOnly={!editing}
            showEra={editing}
            showEraLabel={!editing}
            inputClassName="inline-editable-input"
            onChange={onToChange}
            onBlur={() => finishEditing(() => {
              if (canSaveRange) onBlur();
            })}
            isInvalid={rangeOrderInvalid}
          />
        </div>
      )}
    />
  );
}
