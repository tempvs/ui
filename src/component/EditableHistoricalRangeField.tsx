import React from "react";

import EditableFieldRow, { type SaveStatus } from "./EditableFieldRow";
import {
  HistoricalYearControl,
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
};

/**
 * A paired field implemented through EditableFieldRow. The two endpoint
 * controls remain mounted in both modes, so editing cannot move surrounding
 * markup or change the field's typography and vertical rhythm.
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
}: Props) {
  const rangeOrderInvalid = !isChronologicalHistoricalRange(from, to);
  const canSaveRange = isValidHistoricalRange(from, to);
  return (
    <EditableFieldRow
      label={label}
      editable={editable}
      status={status}
      className={className}
      fieldMaxWidth={fieldMaxWidth}
      renderControl={({ editing, onBlur: finishEditing }) => (
        <div className="historical-range-inline-control d-flex align-items-center gap-1">
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
